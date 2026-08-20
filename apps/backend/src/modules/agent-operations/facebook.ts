import { createHmac, timingSafeEqual } from "node:crypto"
import { ChannelPrincipal } from "./channel-principal"
import { CustomerChatSecurityConfig } from "./customer-chat-security"

export type FacebookMessengerIdentity = {
  psid: string
  user_id: string
}

export type FacebookMessengerChannelConfig = {
  allow_unmapped_users?: boolean
  api_base_url?: string
  app_id?: string
  identities: FacebookMessengerIdentity[]
  page_avatar?: string
  page_id?: string
  page_name?: string
  security?: Partial<CustomerChatSecurityConfig>
  verify_token?: string
  webhook_secret_ref?: string
  webhook_url?: string
}

export type FacebookStoredCredentialPayload = {
  app_id?: string
  app_secret?: string
  page_access_token: string
  page_avatar?: string
  page_id?: string
  page_name?: string
  verify_token?: string
}

export function resolveFacebookPrincipal(
  config: FacebookMessengerChannelConfig,
  psid: string
): ChannelPrincipal | null {
  const identity = config.identities?.find((i) => i.psid === psid)
  if (identity) {
    return {
      external_user_id: psid,
      principal_id: identity.user_id,
      role: "CUSTOMER",
    }
  }
  if (config.allow_unmapped_users === false) return null

  return {
    external_user_id: psid,
    principal_id: `messenger:${psid}`,
    role: "CUSTOMER",
  }
}

export function verifyFacebookWebhookSignature(options: {
  appSecret?: string
  bodyString: string
  expectedSignature?: string
}): boolean {
  if (!options.expectedSignature || !options.appSecret) {
    // If no app secret is configured, allow if optional
    return !options.appSecret
  }

  try {
    // Meta sends x-hub-signature-256: sha256=<hash>
    const signatureHash = options.expectedSignature.startsWith("sha256=")
      ? options.expectedSignature.slice(7)
      : options.expectedSignature

    const computed = createHmac("sha256", options.appSecret)
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
