import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import type {
  IEventBusModuleService,
  ILockingModule,
} from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import {
  resolveFacebookPrincipal,
  verifyFacebookWebhookSignature,
  FacebookMessengerChannelConfig,
} from "../../modules/agent-operations/facebook"
import { getConversationTopicType } from "../../modules/agent-operations/channel-principal"
import {
  evaluateCustomerChatIngress,
  normalizeCustomerChatSecurityConfig,
} from "../../modules/agent-operations/customer-chat-security"

export type IngestMessengerWebhookInput = {
  body: {
    entry?: Array<{
      id?: string
      messaging?: Array<{
        message?: {
          attachments?: Array<{
            payload?: { url?: string }
            type?: string
          }>
          is_echo?: boolean
          mid?: string
          text?: string
        }
        recipient?: { id: string }
        sender?: { id: string }
        timestamp?: number | string
      }>
      time?: number | string
    }>
    object?: string
  }
  connection_id: string
  raw_body?: string
  signature?: string
}

export type IngestMessengerWebhookResult = {
  accepted: boolean
  conversation_id?: string
  duplicate?: boolean
  ignored?: boolean
  message_id?: string
  reason?:
    | "BLOCKED"
    | "CHANNEL_INACTIVE"
    | "CAPACITY_LIMIT"
    | "DAILY_LIMIT"
    | "INVALID_SECRET"
    | "MESSAGE_TOO_LONG"
    | "RATE_LIMITED"
    | "STALE_UPDATE"
}

const isTrustedMessengerImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      (url.hostname === "lookaside.fbsbx.com" ||
        url.hostname.endsWith(".fbsbx.com") ||
        url.hostname.endsWith(".fbcdn.net") ||
        url.hostname.endsWith(".facebook.com"))
    )
  } catch {
    return false
  }
}

const ingestMessengerWebhookStep = createStep<
  IngestMessengerWebhookInput,
  IngestMessengerWebhookResult,
  undefined
>(
  "ingest-messenger-webhook",
  async (input: IngestMessengerWebhookInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const connection = await service.retrieveAgentChannelConnection(
      input.connection_id
    )
    if (connection.channel !== "MESSENGER" || connection.status !== "ACTIVE") {
      return new StepResponse<IngestMessengerWebhookResult>({
        accepted: false,
        reason: "CHANNEL_INACTIVE",
      })
    }

    const config = connection.config as FacebookMessengerChannelConfig
    let expectedSecret = ""
    try {
      expectedSecret = await service.resolveChannelWebhookSecret(connection)
    } catch {
      expectedSecret = ""
    }

    if (expectedSecret && input.signature) {
      const bodyToVerify = input.raw_body || JSON.stringify(input.body)
      const isValid = verifyFacebookWebhookSignature({
        appSecret: expectedSecret,
        bodyString: bodyToVerify,
        expectedSignature: input.signature,
      })
      if (!isValid) {
        return new StepResponse<IngestMessengerWebhookResult>({
          accepted: false,
          reason: "INVALID_SECRET",
        })
      }
    }

    // Extract first inbound text message from Meta webhook structure
    const entry = input.body.entry?.[0]
    const messaging = entry?.messaging?.[0]

    if (
      !messaging ||
      messaging.message?.is_echo ||
      !(messaging.message?.text || messaging.message?.attachments?.length) ||
      !messaging.sender?.id ||
      messaging.sender.id === entry?.id ||
      messaging.sender.id === config.page_id
    ) {
      return new StepResponse<IngestMessengerWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const psid = String(messaging.sender.id)
    const messageText =
      messaging.message.text ?? "Khách đã gửi ảnh để shop kiểm tra."
    const principal = resolveFacebookPrincipal(config, psid)
    if (!principal) {
      return new StepResponse<IngestMessengerWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const result = await locking.execute(
      [
        `messenger-ingress:${connection.id}:global`,
        `messenger-ingress:${connection.id}:${psid}`,
      ],
      async (): Promise<IngestMessengerWebhookResult> => {
        const msgId =
          messaging.message?.mid ||
          String(messaging.timestamp || Date.now())
        const idempotencyKey = `messenger:${connection.id}:msg:${msgId}`
        const existing = (
          await service.listAgentMessages(
            { idempotency_key: idempotencyKey },
            { take: 1 }
          )
        )[0]
        if (existing) {
          return {
            accepted: true,
            conversation_id: existing.conversation_id,
            duplicate: true,
            message_id: existing.id,
          }
        }

        const security = normalizeCustomerChatSecurityConfig(config.security)
        const [recentMessages, globalMessages] = await Promise.all([
          service.listAgentMessages(
            {
              channel: "MESSENGER",
              direction: "INBOUND",
              sender_id: principal.principal_id,
            },
            {
              order: { occurred_at: "DESC" },
              take: Math.min(
                Math.max(security.daily_limit, security.burst_limit),
                1_000
              ),
            }
          ),
          service.listAgentMessages(
            { channel: "MESSENGER", direction: "INBOUND" },
            {
              order: { occurred_at: "DESC" },
              take: Math.min(
                Math.max(
                  security.global_daily_limit,
                  security.global_burst_limit
                ),
                10_000
              ),
            }
          ),
        ])
        const now = new Date()
        const updateDate = messaging.timestamp
          ? new Date(
              typeof messaging.timestamp === "number"
                ? messaging.timestamp
                : Number(messaging.timestamp)
            )
          : now

        const ingressDecision = evaluateCustomerChatIngress({
          chat_id: psid,
          config: security,
          global_message_times: globalMessages.map(
            (message) => message.occurred_at
          ),
          message_length: messageText.length,
          now,
          recent_message_times: recentMessages.map((message) => message.occurred_at),
          update_date: updateDate,
        })
        if (!ingressDecision.allowed) {
          await service.createAgentAuditEvents({
            action: "messenger-message-rejected",
            actor_id: principal.principal_id,
            actor_type: "user",
            correlation_id: `messenger:${connection.id}:${msgId}`,
            data: {
              channel: "MESSENGER",
              connection_id: connection.id,
              reason: ingressDecision.reason,
            },
            event_type: "agent.channel.message-rejected",
            recorded_at: now,
            resource_id: connection.id,
            resource_type: "agent_channel_connection",
          })
          return {
            accepted: true,
            ignored: true,
            reason: ingressDecision.reason,
          }
        }

        const topicType = getConversationTopicType(principal.role)
        const topicId = `${connection.id}:${principal.role.toLowerCase()}:chat:${psid}`
        let conversation = (
          await service.listAgentConversations(
            { channel: "MESSENGER", topic_id: topicId, topic_type: topicType },
            { take: 1 }
          )
        )[0]
        const occurredAt = updateDate
        let title = conversation?.title
        let customerName = ""
        if (!conversation || title === `Facebook — ${psid}`) {
          try {
            const pageToken = await service.resolveChannelBotToken(connection)
            const fbRes = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name,name,profile_pic&access_token=${pageToken}`)
            if (fbRes.ok) {
              const fbProfile = await fbRes.json()
              const name = fbProfile.name || `${fbProfile.first_name || ''} ${fbProfile.last_name || ''}`.trim()
              if (name) {
                customerName = name
                title = `Facebook — ${name}`
              }
            }
          } catch (e) {
            // ignore error and fallback
          }
        }
        title = title || `Facebook — ${psid}`
        if (!customerName && title && title.startsWith("Facebook — ") && title !== `Facebook — ${psid}`) {
          customerName = title.replace(/^Facebook\s+[—–-]\s+/iu, "").trim()
        }

        if (!conversation) {
          conversation = await service.createAgentConversations({
            channel: "MESSENGER",
            external_thread_id: psid,
            last_message_at: occurredAt,
            metadata: {
              connection_id: connection.id,
              customer_name: customerName || undefined,
              facebook_page_id: config.page_id || entry?.id,
              facebook_psid: psid,
              mapped_user_id: principal.principal_id,
              principal_role: principal.role,
              sender_name: customerName || undefined,
            },
            opened_at: occurredAt,
            status: "OPEN",
            tenant_id: connection.tenant_id,
            title: title,
            topic_id: topicId,
            topic_type: topicType,
          })
        } else if (conversation.title !== title || (customerName && !(conversation.metadata as any)?.customer_name)) {
          conversation = await service.updateAgentConversations({
            id: conversation.id,
            metadata: {
              ...((conversation.metadata as Record<string, unknown>) ?? {}),
              customer_name: customerName || (conversation.metadata as any)?.customer_name,
              sender_name: customerName || (conversation.metadata as any)?.sender_name,
            },
            title: title,
            last_message_at: occurredAt,
          })
        } else {
          await service.updateAgentConversations({
            id: conversation.id,
            last_message_at: occurredAt,
          })
        }

        let imageAttachments: Array<{ id: string; url: string }> = []
        const imageUrls = (messaging.message?.attachments ?? [])
          .filter((attachment) => attachment.type === "image")
          .flatMap((attachment) =>
            typeof attachment.payload?.url === "string" &&
            isTrustedMessengerImageUrl(attachment.payload.url)
              ? [attachment.payload.url]
              : []
          )
          .slice(0, 3)
        if (imageUrls.length) {
          try {
            const pageToken = await service.resolveChannelBotToken(connection)
            const uploadedFiles = await Promise.all(
              imageUrls.map(async (url, index) => {
                const response = await fetch(url, {
                  headers: { Authorization: `Bearer ${pageToken}` },
                })
                const contentType = response.headers
                  .get("content-type")
                  ?.split(";", 1)[0]
                const contentLength = Number(response.headers.get("content-length"))
                if (
                  !response.ok ||
                  !contentType ||
                  !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
                  (Number.isFinite(contentLength) && contentLength > 5 * 1024 * 1024)
                ) {
                  throw new MedusaError(
                    MedusaError.Types.INVALID_DATA,
                    "Messenger image is invalid or unsupported."
                  )
                }
                const content = Buffer.from(await response.arrayBuffer())
                if (
                  !content.length ||
                  content.length > 5 * 1024 * 1024
                ) {
                  throw new MedusaError(
                    MedusaError.Types.INVALID_DATA,
                    "Messenger image is invalid or unsupported."
                  )
                }
                return {
                  access: "public" as const,
                  content: content.toString("base64"),
                  filename: `messenger-${msgId}-${index}.${contentType.split("/")[1]}`,
                  mimeType: contentType,
                }
              })
            )
            const { result: uploaded } = await uploadFilesWorkflow(container).run({
              input: { files: uploadedFiles },
            })
            imageAttachments = uploaded.map((file) => ({ id: file.id, url: file.url }))
          } catch (error) {
            await service.createAgentAuditEvents({
              action: "messenger-image-ingestion-failed",
              actor_id: principal.principal_id,
              actor_type: "user",
              correlation_id: `messenger:${connection.id}:${msgId}`,
              data: {
                error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
              },
              event_type: "agent.channel.image-ingestion-failed",
              recorded_at: new Date(),
              resource_id: connection.id,
              resource_type: "agent_channel_connection",
            })
          }
        }

        const message = await service.createAgentMessages({
          body: messageText,
          channel: "MESSENGER",
          conversation_id: conversation.id,
          direction: "INBOUND",
          external_message_id: msgId,
          idempotency_key: idempotencyKey,
          message_type: "TEXT",
          occurred_at: occurredAt,
          processed_at: new Date(),
          sender_id: principal.principal_id,
          sender_type: "user",
          status: "PROCESSED",
          structured_content: {
            facebook_entry_id: entry?.id,
            facebook_msg_id: msgId,
            facebook_page_id: config.page_id || entry?.id,
            facebook_psid: psid,
            principal_role: principal.role,
            image_attachments: imageAttachments,
          },
        })
        await service.updateAgentConversations({
          id: conversation.id,
          last_message_at: occurredAt,
        })
        await service.createAgentAuditEvents({
          action: "messenger-message-received",
          actor_id: principal.principal_id,
          actor_type: "user",
          correlation_id: `messenger:${connection.id}:${msgId}`,
          data: {
            channel: "MESSENGER",
            connection_id: connection.id,
            conversation_id: conversation.id,
            principal_role: principal.role,
          },
          event_type: "agent.channel.message-received",
          recorded_at: new Date(),
          resource_id: message.id,
          resource_type: "agent_message",
        })

        return {
          accepted: true,
          conversation_id: conversation.id,
          duplicate: false,
          message_id: message.id,
        }
      }
    )

    if (result.accepted && result.message_id && !result.ignored) {
      const eventBus = container.resolve<IEventBusModuleService>(
        Modules.EVENT_BUS
      )
      await eventBus.emit({
        data: { inbound_message_id: result.message_id },
        name: "agent.messenger.customer-message-received",
      })
    }

    return new StepResponse<IngestMessengerWebhookResult>(result)
  }
)

export const ingestMessengerWebhookWorkflow = createWorkflow(
  "ingest-messenger-webhook",
  function (input: IngestMessengerWebhookInput) {
    return new WorkflowResponse(ingestMessengerWebhookStep(input))
  }
)
