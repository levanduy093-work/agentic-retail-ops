import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { TelegramChannelIdentity } from "../modules/agent-operations/telegram"
import { configureTelegramChannelWorkflow } from "../workflows/agent-operations/configure-telegram-channel"

function readInteger(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) ? value : fallback
}

function readBlockedChatIds() {
  let parsed: unknown
  try {
    parsed = JSON.parse(
      process.env.TELEGRAM_BLOCKED_CHAT_IDS_JSON ?? "[]"
    ) as unknown
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "TELEGRAM_BLOCKED_CHAT_IDS_JSON must be a JSON array of strings."
    )
  }
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "TELEGRAM_BLOCKED_CHAT_IDS_JSON must be a JSON array of strings."
    )
  }
  return parsed as string[]
}

function readIdentities() {
  try {
    const parsed = JSON.parse(
      process.env.TELEGRAM_IDENTITIES_JSON ?? "[]"
    ) as TelegramChannelIdentity[]
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (identity) =>
          !identity ||
          typeof identity.chat_id !== "string" ||
          typeof identity.user_id !== "string"
      )
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "invalid identity entry"
      )
    }
    return parsed
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "TELEGRAM_IDENTITIES_JSON must contain chat_id and user_id strings."
    )
  }
}

export default async function configureTelegramChannel({
  container,
}: ExecArgs) {
  const publicBaseUrl = process.env.TELEGRAM_PUBLIC_BASE_URL?.trim()
  if (!publicBaseUrl) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "TELEGRAM_PUBLIC_BASE_URL is required."
    )
  }

  const { result } = await configureTelegramChannelWorkflow(container).run({
    input: {
      account_ref: process.env.TELEGRAM_BOT_ACCOUNT_REF ?? "primary",
      allow_unmapped_users:
        process.env.TELEGRAM_ALLOW_UNMAPPED_USERS?.trim().toLowerCase() !==
        "false",
      api_base_url: process.env.TELEGRAM_API_BASE_URL,
      identities: readIdentities(),
      public_base_url: publicBaseUrl,
      security: {
        blocked_chat_ids: readBlockedChatIds(),
        burst_limit: readInteger("TELEGRAM_BURST_LIMIT", 6),
        burst_window_seconds: readInteger("TELEGRAM_BURST_WINDOW_SECONDS", 60),
        daily_limit: readInteger("TELEGRAM_DAILY_LIMIT", 100),
        global_burst_limit: readInteger("TELEGRAM_GLOBAL_BURST_LIMIT", 120),
        global_daily_limit: readInteger("TELEGRAM_GLOBAL_DAILY_LIMIT", 5_000),
        max_message_characters: readInteger(
          "TELEGRAM_MAX_MESSAGE_CHARACTERS",
          2_000
        ),
        max_open_escalations: readInteger(
          "TELEGRAM_MAX_OPEN_ESCALATIONS",
          3
        ),
        max_update_age_seconds: readInteger(
          "TELEGRAM_MAX_UPDATE_AGE_SECONDS",
          300
        ),
      },
      tenant_id: process.env.TELEGRAM_TENANT_ID ?? "default",
    },
  })

  console.log(
    JSON.stringify(
      {
        bot_username: result.bot_username,
        connection_id: result.connection.id,
        secret_storage: "environment-reference-only",
        status: result.connection.status,
        webhook_url: result.webhook_url,
      },
      null,
      2
    )
  )
}
