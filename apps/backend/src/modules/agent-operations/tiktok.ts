import { createHmac, timingSafeEqual } from "node:crypto"
import { ChannelPrincipal } from "./channel-principal"
import { CustomerChatSecurityConfig } from "./customer-chat-security"

export type TikTokChannelIdentity = {
  tiktok_user_id: string
  user_id: string
}

export type TikTokChannelConfig = {
  account_avatar?: string
  account_id?: string
  account_name?: string
  allow_unmapped_users?: boolean
  api_base_url?: string
  client_key?: string
  identities: TikTokChannelIdentity[]
  security?: Partial<CustomerChatSecurityConfig>
  webhook_secret_ref?: string
  webhook_url?: string
}

export type TikTokStoredCredentialPayload = {
  access_token: string
  account_avatar?: string
  account_id?: string
  account_name?: string
  client_key?: string
  client_secret?: string
  refresh_token?: string
  webhook_secret?: string
}

export function resolveTikTokPrincipal(
  config: TikTokChannelConfig,
  tiktokUserId: string
): ChannelPrincipal | null {
  const identity = config.identities?.find((i) => i.tiktok_user_id === tiktokUserId)
  if (identity) {
    return {
      external_user_id: tiktokUserId,
      principal_id: identity.user_id,
      role: "CUSTOMER",
    }
  }
  if (config.allow_unmapped_users === false) return null

  return {
    external_user_id: tiktokUserId,
    principal_id: `tiktok:${tiktokUserId}`,
    role: "CUSTOMER",
  }
}

export function verifyTikTokWebhookSignature(options: {
  bodyString: string
  clientSecret?: string
  expectedSignature?: string
}): boolean {
  if (!options.expectedSignature || !options.clientSecret) {
    return !options.clientSecret
  }

  try {
    const signatureHash = options.expectedSignature.startsWith("sha256=")
      ? options.expectedSignature.slice(7)
      : options.expectedSignature

    const computed = createHmac("sha256", options.clientSecret)
      .update(options.bodyString, "utf8")
      .digest("hex")

    const computedBuffer = Buffer.from(computed.toLowerCase())
    const expectedBuffer = Buffer.from(signatureHash.toLowerCase())

    if (computedBuffer.length !== expectedBuffer.length) {
      return false
    }

    return timingSafeEqual(computedBuffer, expectedBuffer)
  } catch {
    return false
  }
}
