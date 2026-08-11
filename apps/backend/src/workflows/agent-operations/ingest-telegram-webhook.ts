import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { resolveSecretReference } from "../../modules/agent-operations/secret-reference"
import {
  findTelegramIdentity,
  secureTokenMatches,
  TelegramChannelConfig,
} from "../../modules/agent-operations/telegram"

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
  reason?: "CHANNEL_INACTIVE" | "INVALID_SECRET"
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
    const expectedSecret = resolveSecretReference(config.webhook_secret_ref)
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
    const identity = findTelegramIdentity(config, chatId)
    if (!identity) {
      return new StepResponse<IngestTelegramWebhookResult>({
        accepted: true,
        ignored: true,
      })
    }

    const idempotencyKey = `telegram:${connection.id}:update:${input.update.update_id}`
    const existing = (
      await service.listAgentMessages(
        { idempotency_key: idempotencyKey },
        { take: 1 }
      )
    )[0]
    if (existing) {
      return new StepResponse<IngestTelegramWebhookResult>({
        accepted: true,
        conversation_id: existing.conversation_id,
        duplicate: true,
        message_id: existing.id,
      })
    }

    const topicId = `${connection.id}:chat:${chatId}`
    let conversation = (
      await service.listAgentConversations(
        { channel: "TELEGRAM", topic_id: topicId, topic_type: "OPERATOR_CHAT" },
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
          mapped_user_id: identity.user_id,
          telegram_chat_id: chatId,
          telegram_username: telegramMessage.from?.username,
        },
        opened_at: occurredAt,
        status: "OPEN",
        tenant_id: connection.tenant_id,
        title: senderName ? `Telegram — ${senderName}` : `Telegram — ${chatId}`,
        topic_id: topicId,
        topic_type: "OPERATOR_CHAT",
      })
    }

    const message = await service.createAgentMessages({
      body: telegramMessage.text,
      channel: "TELEGRAM",
      conversation_id: conversation.id,
      direction: "INBOUND",
      external_message_id: String(telegramMessage.message_id),
      idempotency_key: idempotencyKey,
      message_type: "TEXT",
      occurred_at: occurredAt,
      processed_at: new Date(),
      sender_id: identity.user_id,
      sender_type: "user",
      status: "PROCESSED",
      structured_content: {
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
      actor_id: identity.user_id,
      actor_type: "user",
      correlation_id: `telegram:${connection.id}:${input.update.update_id}`,
      data: {
        channel: "TELEGRAM",
        connection_id: connection.id,
        conversation_id: conversation.id,
      },
      event_type: "agent.channel.message-received",
      recorded_at: new Date(),
      resource_id: message.id,
      resource_type: "agent_message",
    })

    return new StepResponse<IngestTelegramWebhookResult>({
      accepted: true,
      conversation_id: conversation.id,
      duplicate: false,
      message_id: message.id,
    })
  }
)

export const ingestTelegramWebhookWorkflow = createWorkflow(
  "ingest-telegram-webhook",
  function (input: IngestTelegramWebhookInput) {
    return new WorkflowResponse(ingestTelegramWebhookStep(input))
  }
)
