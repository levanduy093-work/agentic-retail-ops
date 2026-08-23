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
import { Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import {
  resolveTikTokPrincipal,
  verifyTikTokWebhookSignature,
  TikTokChannelConfig,
} from "../../modules/agent-operations/tiktok"
import { getConversationTopicType } from "../../modules/agent-operations/channel-principal"
import {
  evaluateCustomerChatIngress,
  normalizeCustomerChatSecurityConfig,
} from "../../modules/agent-operations/customer-chat-security"

export type IngestTikTokWebhookInput = {
  body: {
    client_key?: string
    data?: {
      content?: string
      conversation_id?: string
      from_user_id?: string
      message?: {
        content?: string
        msg_id?: string
        msg_type?: string
      }
      message_id?: string
      sender?: {
        avatar_url?: string
        im_user_id?: string
        nickname?: string
        open_id?: string
        role?: string
      }
      text?: string
      to_user_id?: string
      type?: string
    }
    event?: string
    shop_id?: string
    timestamp?: number | string
    type?: number | string
  }
  connection_id: string
  raw_body?: string
  signature?: string
}

export type IngestTikTokWebhookResult = {
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

const ingestTikTokWebhookStep = createStep<
  IngestTikTokWebhookInput,
  IngestTikTokWebhookResult,
  undefined
>(
  "ingest-tik-tok-webhook",
  async (input: IngestTikTokWebhookInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const connection = await service.retrieveAgentChannelConnection(
      input.connection_id
    )
    if (connection.channel !== "TIKTOK" || connection.status !== "ACTIVE") {
      return new StepResponse<IngestTikTokWebhookResult>({
        accepted: false,
        reason: "CHANNEL_INACTIVE",
      })
    }

    const config = connection.config as TikTokChannelConfig
    let expectedSecret = ""
    try {
      expectedSecret = await service.resolveChannelWebhookSecret(connection)
    } catch {
      expectedSecret = ""
    }

    if (expectedSecret && input.signature) {
      const bodyToVerify = input.raw_body || JSON.stringify(input.body)
      const isValid = verifyTikTokWebhookSignature({
        bodyString: bodyToVerify,
        clientSecret: expectedSecret,
        expectedSignature: input.signature,
      })
      if (!isValid) {
        return new StepResponse<IngestTikTokWebhookResult>({
          accepted: false,
          reason: "INVALID_SECRET",
        })
      }
    }

    const data = input.body.data
    if (!data) {
      return new StepResponse<IngestTikTokWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    // Extract text content from TikTok payload
    let messageText = ""
    if (data.message?.content) {
      try {
        const parsed = JSON.parse(data.message.content)
        messageText = parsed.text || data.message.content
      } catch {
        messageText = data.message.content
      }
    } else if (data.content) {
      try {
        const parsed = JSON.parse(data.content)
        messageText = parsed.text || data.content
      } catch {
        messageText = data.content
      }
    } else if (data.text) {
      messageText = data.text
    }

    messageText = messageText.trim()
    if (!messageText) {
      return new StepResponse<IngestTikTokWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const senderId =
      data.sender?.open_id ||
      data.sender?.im_user_id ||
      data.from_user_id ||
      ""

    if (!senderId || senderId === config.account_id) {
      return new StepResponse<IngestTikTokWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const principal = resolveTikTokPrincipal(config, senderId)
    if (!principal) {
      return new StepResponse<IngestTikTokWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const conversationRef = data.conversation_id || senderId

    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const result = await locking.execute(
      [
        `tiktok-ingress:${connection.id}:global`,
        `tiktok-ingress:${connection.id}:${senderId}`,
      ],
      async (): Promise<IngestTikTokWebhookResult> => {
        const msgId =
          data.message?.msg_id ||
          data.message_id ||
          String(input.body.timestamp || Date.now())
        const idempotencyKey = `tiktok:${connection.id}:msg:${msgId}`
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
              channel: "TIKTOK",
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
            { channel: "TIKTOK", direction: "INBOUND" },
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
        const updateDate = input.body.timestamp
          ? new Date(
              typeof input.body.timestamp === "number"
                ? input.body.timestamp * 1000 < 2_000_000_000_000
                  ? input.body.timestamp * 1000
                  : input.body.timestamp
                : Number(input.body.timestamp)
            )
          : now

        const ingressDecision = evaluateCustomerChatIngress({
          chat_id: senderId,
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
            action: "tiktok-message-rejected",
            actor_id: principal.principal_id,
            actor_type: "user",
            correlation_id: `tiktok:${connection.id}:${msgId}`,
            data: {
              channel: "TIKTOK",
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
        const topicId = `${connection.id}:${principal.role.toLowerCase()}:chat:${senderId}`
        let conversation = (
          await service.listAgentConversations(
            { channel: "TIKTOK", topic_id: topicId, topic_type: topicType },
            { take: 1 }
          )
        )[0]
        const occurredAt = updateDate
        const senderName = data.sender?.nickname || senderId
        const title = `TikTok — ${senderName}`

        if (!conversation) {
          conversation = await service.createAgentConversations({
            channel: "TIKTOK",
            external_thread_id: conversationRef,
            last_message_at: occurredAt,
            metadata: {
              connection_id: connection.id,
              mapped_user_id: principal.principal_id,
              principal_role: principal.role,
              tiktok_conversation_id: data.conversation_id,
              tiktok_sender_id: senderId,
            },
            opened_at: occurredAt,
            status: "OPEN",
            tenant_id: connection.tenant_id,
            title: title,
            topic_id: topicId,
            topic_type: topicType,
          })
        } else {
          await service.updateAgentConversations({
            id: conversation.id,
            last_message_at: occurredAt,
          })
        }

        const message = await service.createAgentMessages({
          body: messageText,
          channel: "TIKTOK",
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
            principal_role: principal.role,
            tiktok_conversation_id: conversationRef,
            tiktok_msg_id: msgId,
            tiktok_sender_id: senderId,
          },
        })

        await service.createAgentAuditEvents({
          action: "tiktok-message-received",
          actor_id: principal.principal_id,
          actor_type: "user",
          correlation_id: `tiktok:${connection.id}:${msgId}`,
          data: {
            channel: "TIKTOK",
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
        name: "agent.tiktok.customer-message-received",
      })
    }

    return new StepResponse<IngestTikTokWebhookResult>(result)
  }
)

export const ingestTikTokWebhookWorkflow = createWorkflow(
  "ingest-tik-tok-webhook",
  function (input: IngestTikTokWebhookInput) {
    return new WorkflowResponse(ingestTikTokWebhookStep(input))
  }
)
