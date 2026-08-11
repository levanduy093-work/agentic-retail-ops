import { timingSafeEqual } from "node:crypto"

export type TelegramChannelIdentity = {
  chat_id: string
  user_id: string
}

export type TelegramChannelConfig = {
  api_base_url?: string
  identities: TelegramChannelIdentity[]
  webhook_secret_ref: string
  webhook_url?: string
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
