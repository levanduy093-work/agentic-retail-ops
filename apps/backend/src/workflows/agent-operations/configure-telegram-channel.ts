import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { resolveSecretReference } from "../../modules/agent-operations/secret-reference"
import { TelegramChannelIdentity } from "../../modules/agent-operations/telegram"

export type ConfigureTelegramChannelInput = {
  account_ref: string
  api_base_url?: string
  bot_token_ref?: string
  identities: TelegramChannelIdentity[]
  public_base_url: string
  tenant_id?: string
  webhook_secret_ref?: string
}

type TelegramApiResponse<T> = {
  description?: string
  ok: boolean
  result?: T
}

async function telegramRequest<T>(
  apiBaseUrl: string,
  botToken: string,
  method: string,
  body: Record<string, unknown>
) {
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/bot${botToken}/${method}`,
    {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    }
  )
  const payload = (await response.json()) as TelegramApiResponse<T>
  if (!response.ok || !payload.ok || payload.result === undefined) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Telegram ${method} failed: ${payload.description ?? `HTTP ${response.status}`}`
    )
  }

  return payload.result
}

const configureTelegramChannelStep = createStep(
  "configure-telegram-channel",
  async (input: ConfigureTelegramChannelInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const publicBaseUrl = input.public_base_url.replace(/\/$/, "")
    if (!publicBaseUrl.startsWith("https://")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Telegram public_base_url must use HTTPS."
      )
    }
    if (!input.identities.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "At least one Telegram chat-to-user identity is required."
      )
    }

    const botTokenRef = input.bot_token_ref ?? "env:TELEGRAM_BOT_TOKEN"
    const webhookSecretRef =
      input.webhook_secret_ref ?? "env:TELEGRAM_WEBHOOK_SECRET"
    const botToken = resolveSecretReference(botTokenRef)
    const webhookSecret = resolveSecretReference(webhookSecretRef)
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "TELEGRAM_WEBHOOK_SECRET contains unsupported characters."
      )
    }

    const apiBaseUrl = input.api_base_url ?? "https://api.telegram.org"
    const bot = await telegramRequest<{
      first_name: string
      id: number
      username?: string
    }>(apiBaseUrl, botToken, "getMe", {})
    const existing = (
      await service.listAgentChannelConnections(
        {
          account_ref: input.account_ref,
          channel: "TELEGRAM",
          tenant_id: input.tenant_id ?? "default",
        },
        { take: 1 }
      )
    )[0]
    const disabledConnection = existing
      ? await service.updateAgentChannelConnections({
          config: {
            api_base_url: apiBaseUrl,
            bot_id: String(bot.id),
            bot_username: bot.username,
            identities: input.identities,
            webhook_secret_ref: webhookSecretRef,
          },
          id: existing.id,
          secret_ref: botTokenRef,
          status: "DISABLED",
        })
      : await service.createAgentChannelConnections({
          account_ref: input.account_ref,
          channel: "TELEGRAM",
          config: {
            api_base_url: apiBaseUrl,
            bot_id: String(bot.id),
            bot_username: bot.username,
            identities: input.identities,
            webhook_secret_ref: webhookSecretRef,
          },
          secret_ref: botTokenRef,
          status: "DISABLED",
          tenant_id: input.tenant_id ?? "default",
        })
    const webhookUrl = `${publicBaseUrl}/webhooks/agent-operations/telegram/${disabledConnection.id}`

    try {
      await telegramRequest<boolean>(apiBaseUrl, botToken, "setWebhook", {
        allowed_updates: ["message"],
        drop_pending_updates: false,
        secret_token: webhookSecret,
        url: webhookUrl,
      })
    } catch (error) {
      await service.updateAgentChannelConnections({
        id: disabledConnection.id,
        status: "DISABLED",
      })
      throw error
    }

    const connection = await service.updateAgentChannelConnections({
      config: {
        ...(disabledConnection.config as Record<string, unknown>),
        webhook_url: webhookUrl,
      },
      id: disabledConnection.id,
      status: "ACTIVE",
    })
    await service.createAgentAuditEvents({
      action: "telegram-channel-configured",
      actor_id: "telegram-configuration-script",
      actor_type: "system",
      correlation_id: `telegram:connection:${connection.id}`,
      data: {
        account_ref: connection.account_ref,
        bot_username: bot.username,
        identity_count: input.identities.length,
      },
      event_type: "agent.channel.configured",
      recorded_at: new Date(),
      resource_id: connection.id,
      resource_type: "agent_channel_connection",
    })

    return new StepResponse({
      bot_username: bot.username,
      connection,
      webhook_url: webhookUrl,
    })
  }
)

export const configureTelegramChannelWorkflow = createWorkflow(
  "configure-telegram-channel",
  function (input: ConfigureTelegramChannelInput) {
    return new WorkflowResponse(configureTelegramChannelStep(input))
  }
)
