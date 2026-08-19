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
import { resolveSecretReference } from "../../modules/agent-operations/secret-reference"
import {
  resolveTelegramPrincipal,
  secureTokenMatches,
  TelegramChannelConfig,
} from "../../modules/agent-operations/telegram"
import { getConversationTopicType } from "../../modules/agent-operations/channel-principal"
import {
  evaluateCustomerChatIngress,
  normalizeCustomerChatSecurityConfig,
} from "../../modules/agent-operations/customer-chat-security"

export type IngestTelegramWebhookInput = {
  connection_id: string
  secret_token: string
  update: {
    message?: {
      chat: { id: number; type: string }
      date: number
      from?: {
        first_name?: string
        id: number
        is_bot: boolean
        last_name?: string
        username?: string
      }
      message_id: number
      text?: string
    }
    update_id: number
  }
}

export type IngestTelegramWebhookResult = {
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

const ingestTelegramWebhookStep = createStep<
  IngestTelegramWebhookInput,
  IngestTelegramWebhookResult,
  undefined
>(
  "ingest-telegram-webhook",
  async (input: IngestTelegramWebhookInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const connection = await service.retrieveAgentChannelConnection(
      input.connection_id
    )
    if (connection.channel !== "TELEGRAM" || connection.status !== "ACTIVE") {
      return new StepResponse<IngestTelegramWebhookResult>({
        accepted: false,
        reason: "CHANNEL_INACTIVE",
      })
    }

    const config = connection.config as TelegramChannelConfig
    const expectedSecret = await service.resolveChannelWebhookSecret(connection)
    if (!secureTokenMatches(input.secret_token, expectedSecret)) {
      return new StepResponse<IngestTelegramWebhookResult>({
        accepted: false,
        reason: "INVALID_SECRET",
      })
    }

    const telegramMessage = input.update.message
    if (
      !telegramMessage?.text ||
      telegramMessage.chat.type !== "private" ||
      telegramMessage.from?.is_bot === true
    ) {
      return new StepResponse<IngestTelegramWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const chatId = String(telegramMessage.chat.id)
    const messageText = telegramMessage.text
    const principal = resolveTelegramPrincipal(config, chatId)
    if (!principal) {
      return new StepResponse<IngestTelegramWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const result = await locking.execute(
      [
        `telegram-ingress:${connection.id}:global`,
        `telegram-ingress:${connection.id}:${chatId}`,
      ],
      async (): Promise<IngestTelegramWebhookResult> => {
        const idempotencyKey = `telegram:${connection.id}:update:${input.update.update_id}`
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
              channel: "TELEGRAM",
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
            { channel: "TELEGRAM", direction: "INBOUND" },
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
        const ingressDecision = evaluateCustomerChatIngress({
          chat_id: chatId,
          config: security,
          global_message_times: globalMessages.map(
            (message) => message.occurred_at
          ),
          message_length: messageText.length,
          now,
          recent_message_times: recentMessages.map((message) => message.occurred_at),
          update_date: new Date(telegramMessage.date * 1_000),
        })
        if (!ingressDecision.allowed) {
          await service.createAgentAuditEvents({
            action: "telegram-message-rejected",
            actor_id: principal.principal_id,
            actor_type: "user",
            correlation_id: `telegram:${connection.id}:${input.update.update_id}`,
            data: {
              channel: "TELEGRAM",
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
        const topicId = `${connection.id}:${principal.role.toLowerCase()}:chat:${chatId}`
        let conversation = (
          await service.listAgentConversations(
            { channel: "TELEGRAM", topic_id: topicId, topic_type: topicType },
            { take: 1 }
          )
        )[0]
        const occurredAt = new Date(telegramMessage.date * 1_000)
        if (!conversation) {
      const senderName = [
        telegramMessage.from?.first_name,
        telegramMessage.from?.last_name,
      ]
        .filter(Boolean)
        .join(" ")
          conversation = await service.createAgentConversations({
        channel: "TELEGRAM",
        external_thread_id: chatId,
        last_message_at: occurredAt,
        metadata: {
          connection_id: connection.id,
          mapped_user_id: principal.principal_id,
          principal_role: principal.role,
          telegram_chat_id: chatId,
          telegram_username: telegramMessage.from?.username,
        },
        opened_at: occurredAt,
        status: "OPEN",
        tenant_id: connection.tenant_id,
        title: senderName ? `Telegram — ${senderName}` : `Telegram — ${chatId}`,
        topic_id: topicId,
        topic_type: topicType,
          })
        }

        const message = await service.createAgentMessages({
      body: messageText,
      channel: "TELEGRAM",
      conversation_id: conversation.id,
      direction: "INBOUND",
      external_message_id: String(telegramMessage.message_id),
      idempotency_key: idempotencyKey,
      message_type: "TEXT",
      occurred_at: occurredAt,
      processed_at: new Date(),
      sender_id: principal.principal_id,
      sender_type: "user",
      status: "PROCESSED",
      structured_content: {
        principal_role: principal.role,
        telegram_from_id: String(telegramMessage.from?.id ?? ""),
        telegram_update_id: input.update.update_id,
      },
        })
        await service.updateAgentConversations({
      id: conversation.id,
      last_message_at: occurredAt,
        })
        await service.createAgentAuditEvents({
      action: "telegram-message-received",
      actor_id: principal.principal_id,
      actor_type: "user",
      correlation_id: `telegram:${connection.id}:${input.update.update_id}`,
      data: {
        channel: "TELEGRAM",
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
        name: "agent.telegram.customer-message-received",
      })
    }

    return new StepResponse<IngestTelegramWebhookResult>(result)
  }
)

export const ingestTelegramWebhookWorkflow = createWorkflow(
  "ingest-telegram-webhook",
  function (input: IngestTelegramWebhookInput) {
    return new WorkflowResponse(ingestTelegramWebhookStep(input))
  }
)
