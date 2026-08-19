import { createHash, timingSafeEqual } from "node:crypto"
import { ChannelPrincipal } from "./channel-principal"
import { CustomerChatSecurityConfig } from "./customer-chat-security"

export type ZaloChannelIdentity = {
  user_id: string
  zalo_user_id: string
}

export type ZaloChannelConfig = {
  allow_unmapped_users?: boolean
  api_base_url?: string
  app_id?: string
  identities: ZaloChannelIdentity[]
  oa_avatar?: string
  oa_id?: string
  oa_name?: string
  security?: Partial<CustomerChatSecurityConfig>
  webhook_secret_ref?: string
  webhook_url?: string
}

export type ZaloStoredCredentialPayload = {
  access_token: string
  app_id?: string
  expires_at?: number
  oa_avatar?: string
  oa_id?: string
  oa_name?: string
  oa_secret_key?: string
  refresh_token?: string
  secret_key?: string
}

export function resolveZaloPrincipal(
  config: ZaloChannelConfig,
  zaloUserId: string
): ChannelPrincipal | null {
  const identity = config.identities.find((i) => i.zalo_user_id === zaloUserId)
  if (identity) {
    return {
      external_user_id: zaloUserId,
      principal_id: identity.user_id,
      role: "CUSTOMER",
    }
  }
  if (!config.allow_unmapped_users) return null

  return {
    external_user_id: zaloUserId,
    principal_id: `zalo:${zaloUserId}`,
    role: "CUSTOMER",
  }
}

export function verifyZaloWebhookSignature(options: {
  appId?: string
  bodyString: string
  expectedSignature?: string
  oaSecretKey?: string
  timestamp?: number | string
}): boolean {
  if (!options.expectedSignature || !options.oaSecretKey) {
    // If no secret configured or no signature passed, allow if secret is optional
    return true
  }

  try {
    // Zalo Webhook signature standard: sha256(appId + bodyString + timestamp + oaSecretKey)
    const raw = `${options.appId ?? ""}${options.bodyString}${options.timestamp ?? ""}${options.oaSecretKey}`
    const computed = createHash("sha256").update(raw, "utf8").digest("hex")

    const computedBuffer = Buffer.from(computed.toLowerCase())
    const expectedBuffer = Buffer.from(options.expectedSignature.toLowerCase())

    if (computedBuffer.length !== expectedBuffer.length) {
      return false
    }

    return timingSafeEqual(computedBuffer, expectedBuffer)
  } catch {
    return false
  }
}
