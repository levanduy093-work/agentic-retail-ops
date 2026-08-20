import { timingSafeEqual } from "node:crypto"
import { ChannelPrincipal } from "./channel-principal"
import { CustomerChatSecurityConfig } from "./customer-chat-security"

export type TelegramChannelIdentity = {
  chat_id: string
  user_id: string
}

export type TelegramChannelConfig = {
  allow_unmapped_users?: boolean
  api_base_url?: string
  identities: TelegramChannelIdentity[]
  security?: Partial<CustomerChatSecurityConfig>
  webhook_secret_ref: string
  webhook_url?: string
}

export function resolveTelegramUserId(
  config: TelegramChannelConfig,
  chatId: string
) {
  const identity = findTelegramIdentity(config, chatId)
  if (identity) return identity.user_id
  return config.allow_unmapped_users ? `telegram:${chatId}` : null
}

export function resolveTelegramPrincipal(
  config: TelegramChannelConfig,
  chatId: string
): ChannelPrincipal | null {
  const identity = findTelegramIdentity(config, chatId)
  if (identity) {
    return {
      external_user_id: chatId,
      principal_id: identity.user_id,
      role: "CUSTOMER",
    }
  }
  if (!config.allow_unmapped_users) return null

  return {
    external_user_id: chatId,
    principal_id: `telegram:${chatId}`,
    role: "CUSTOMER",
  }
}

export function secureTokenMatches(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export function findTelegramIdentity(
  config: TelegramChannelConfig,
  chatId: string
) {
  return config.identities.find((identity) => identity.chat_id === chatId)
}

export function buildTelegramChatActionPayload(
  chatId: string,
  action: "typing" | "upload_photo" | "find_location" = "typing"
) {
  return {
    action,
    chat_id: chatId,
  }
}

