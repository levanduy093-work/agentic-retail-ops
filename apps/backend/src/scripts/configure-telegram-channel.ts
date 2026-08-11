import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { TelegramChannelIdentity } from "../modules/agent-operations/telegram"
import { configureTelegramChannelWorkflow } from "../workflows/agent-operations/configure-telegram-channel"

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
      "TELEGRAM_IDENTITIES_JSON must be a JSON array of chat_id and user_id strings."
    )
  }
}

export default async function configureTelegramChannel({ container }: ExecArgs) {
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
      api_base_url: process.env.TELEGRAM_API_BASE_URL,
      identities: readIdentities(),
      public_base_url: publicBaseUrl,
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
