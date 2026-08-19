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
  resolveZaloPrincipal,
  verifyZaloWebhookSignature,
  ZaloChannelConfig,
} from "../../modules/agent-operations/zalo"
import { getConversationTopicType } from "../../modules/agent-operations/channel-principal"
import {
  evaluateCustomerChatIngress,
  normalizeCustomerChatSecurityConfig,
} from "../../modules/agent-operations/customer-chat-security"

export type IngestZaloWebhookInput = {
  body: {
    app_id?: string
    event_name: string
    message?: {
      msg_id?: string
      text?: string
    }
    oa_id?: string
    recipient?: { id: string }
    sender?: { id: string }
    timestamp?: number | string
    user_id_by_app?: string
  }
  connection_id: string
  signature?: string
}

export type IngestZaloWebhookResult = {
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

const ingestZaloWebhookStep = createStep<
  IngestZaloWebhookInput,
  IngestZaloWebhookResult,
  undefined
>(
  "ingest-zalo-webhook",
  async (input: IngestZaloWebhookInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const connection = await service.retrieveAgentChannelConnection(
      input.connection_id
    )
    if (connection.channel !== "ZALO" || connection.status !== "ACTIVE") {
      return new StepResponse<IngestZaloWebhookResult>({
        accepted: false,
        reason: "CHANNEL_INACTIVE",
      })
    }

    const config = connection.config as ZaloChannelConfig
    let expectedSecret = ""
    try {
      expectedSecret = await service.resolveChannelWebhookSecret(connection)
    } catch {
      expectedSecret = ""
    }

    if (expectedSecret && input.signature) {
      const isValid = verifyZaloWebhookSignature({
        appId: input.body.app_id || config.app_id,
        bodyString: JSON.stringify(input.body),
        expectedSignature: input.signature,
        oaSecretKey: expectedSecret,
        timestamp: input.body.timestamp,
      })
      if (!isValid) {
        return new StepResponse<IngestZaloWebhookResult>({
          accepted: false,
          reason: "INVALID_SECRET",
        })
      }
    }

    if (
      input.body.event_name !== "user_send_text" ||
      !input.body.message?.text ||
      !input.body.sender?.id
    ) {
      return new StepResponse<IngestZaloWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const zaloUserId = String(input.body.sender.id)
    const messageText = input.body.message.text
    const principal = resolveZaloPrincipal(config, zaloUserId)
    if (!principal) {
      return new StepResponse<IngestZaloWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const result = await locking.execute(
      [
        `zalo-ingress:${connection.id}:global`,
        `zalo-ingress:${connection.id}:${zaloUserId}`,
      ],
      async (): Promise<IngestZaloWebhookResult> => {
        const msgId =
          input.body.message?.msg_id || String(input.body.timestamp || Date.now())
        const idempotencyKey = `zalo:${connection.id}:msg:${msgId}`
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
              channel: "ZALO",
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
            { channel: "ZALO", direction: "INBOUND" },
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
                ? input.body.timestamp
                : Number(input.body.timestamp)
            )
          : now

        const ingressDecision = evaluateCustomerChatIngress({
          chat_id: zaloUserId,
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
            action: "zalo-message-rejected",
            actor_id: principal.principal_id,
            actor_type: "user",
            correlation_id: `zalo:${connection.id}:${msgId}`,
            data: {
              channel: "ZALO",
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
        const topicId = `${connection.id}:${principal.role.toLowerCase()}:chat:${zaloUserId}`
        let conversation = (
          await service.listAgentConversations(
            { channel: "ZALO", topic_id: topicId, topic_type: topicType },
            { take: 1 }
          )
        )[0]
        const occurredAt = updateDate
        if (!conversation) {
          conversation = await service.createAgentConversations({
            channel: "ZALO",
            external_thread_id: zaloUserId,
            last_message_at: occurredAt,
            metadata: {
              connection_id: connection.id,
              mapped_user_id: principal.principal_id,
              principal_role: principal.role,
              zalo_oa_id: config.oa_id,
              zalo_user_id: zaloUserId,
            },
            opened_at: occurredAt,
            status: "OPEN",
            tenant_id: connection.tenant_id,
            title: `Zalo — ${zaloUserId}`,
            topic_id: topicId,
            topic_type: topicType,
          })
        }

        const message = await service.createAgentMessages({
          body: messageText,
          channel: "ZALO",
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
            zalo_app_id: input.body.app_id || config.app_id,
            zalo_msg_id: msgId,
            zalo_user_id: zaloUserId,
          },
        })
        await service.updateAgentConversations({
          id: conversation.id,
          last_message_at: occurredAt,
        })
        await service.createAgentAuditEvents({
          action: "zalo-message-received",
          actor_id: principal.principal_id,
          actor_type: "user",
          correlation_id: `zalo:${connection.id}:${msgId}`,
          data: {
            channel: "ZALO",
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
        name: "agent.zalo.customer-message-received",
      })
    }

    return new StepResponse<IngestZaloWebhookResult>(result)
  }
)

export const ingestZaloWebhookWorkflow = createWorkflow(
  "ingest-zalo-webhook",
  function (input: IngestZaloWebhookInput) {
    return new WorkflowResponse(ingestZaloWebhookStep(input))
  }
)
