import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PaymentProviderRegistry } from "./provider-registry"
import { decryptPaymentSecret } from "./credential-vault"
import type PaymentHubModuleService from "./service"
import { PAYMENT_HUB_MODULE } from "./index"

export type PayosEnvironment = "sandbox" | "production"

export type PayosFullSettings = {
  client_id: string
  api_key: string
  checksum_key: string
  environment: PayosEnvironment
  is_enabled: boolean
  is_timeout_enabled: boolean
  timeout_minutes: number
  display_title: string
  order_prefix: string
  updated_at?: string
}

type StoredPaymentProvider = {
  configuration: Record<string, unknown> | string | null
  encrypted_secret: string | null
  encryption_iv: string | null
  encryption_tag: string | null
  key_version: string | null
  encrypted_checksum: string | null
  checksum_iv: string | null
  checksum_tag: string | null
  environment: "SANDBOX" | "PRODUCTION"
  is_enabled: boolean
  name: string
  provider_id: string
  updated_at?: Date | string
}

const DEFAULT_SETTINGS: PayosFullSettings = {
  client_id: process.env.PAYOS_CLIENT_ID || "",
  api_key: process.env.PAYOS_API_KEY || "",
  checksum_key: process.env.PAYOS_CHECKSUM_KEY || "",
  environment: (process.env.PAYOS_ENVIRONMENT as PayosEnvironment) || "production",
  is_enabled: process.env.PAYOS_IS_ENABLED === "true",
  is_timeout_enabled: true,
  timeout_minutes: Number(process.env.PAYOS_TIMEOUT_MINUTES || "15"),
  display_title: "VietQR / Chuyển khoản ngân hàng",
  order_prefix: "DH",
}

export async function getPayosSettings(
  container?: Pick<MedusaContainer, "resolve"> | Record<string, unknown>
): Promise<PayosFullSettings> {
  const registered = PaymentProviderRegistry.get("PAYOS")
  if (registered) {
    const config = (typeof registered.configuration === "string" 
      ? JSON.parse(registered.configuration) 
      : registered.configuration) || {}
    return {
      client_id: String(config.client_id || DEFAULT_SETTINGS.client_id),
      api_key: registered.secret || DEFAULT_SETTINGS.api_key,
      checksum_key: registered.checksum || DEFAULT_SETTINGS.checksum_key,
      environment: registered.environment,
      is_enabled: registered.isEnabled,
      is_timeout_enabled: Boolean(config.is_timeout_enabled ?? DEFAULT_SETTINGS.is_timeout_enabled),
      timeout_minutes: Number(config.timeout_minutes || DEFAULT_SETTINGS.timeout_minutes),
      display_title: String(config.display_title || DEFAULT_SETTINGS.display_title),
      order_prefix: String(config.order_prefix || DEFAULT_SETTINGS.order_prefix),
      updated_at: registered.updatedAt,
    }
  }

  let paymentHub: PaymentHubModuleService | undefined
  let pgConnection: any

  if (container) {
    try {
      if (typeof (container as any)?.resolve === "function") {
        paymentHub = (container as any).resolve(PAYMENT_HUB_MODULE)
      }
    } catch {
      // not available
    }

    try {
      if (!paymentHub && typeof (container as any)[PAYMENT_HUB_MODULE] === "object") {
        paymentHub = (container as any)[PAYMENT_HUB_MODULE]
      }
    } catch {
      // not available
    }

    try {
      if (typeof (container as any)?.resolve === "function") {
        pgConnection = (container as any).resolve(ContainerRegistrationKeys.PG_CONNECTION)
      }
    } catch {
      // not available
    }

    try {
      if (!pgConnection && (container as any).__pg_connection__) {
        pgConnection = (container as any).__pg_connection__
      }
    } catch {
      // not available
    }
  }

  let connection: StoredPaymentProvider | undefined

  if (paymentHub) {
    try {
      const [conn] = (await paymentHub.listPaymentProviderConnections({
        code: "PAYOS",
      })) as StoredPaymentProvider[]
      connection = conn
    } catch {
      // Fall through to pgConnection
    }
  }

  if (!connection && pgConnection) {
    try {
      const rows = await pgConnection("payment_provider_connection")
        .where({ code: "PAYOS" })
        .orderBy("created_at", "desc")
        .limit(1)
      connection = rows[0] as StoredPaymentProvider
    } catch {
      // Fall through
    }
  }

  if (!connection) {
    return { ...DEFAULT_SETTINGS }
  }

  let apiKey = ""
  let checksumKey = ""

  if (
    connection.encrypted_secret &&
    connection.encryption_iv &&
    connection.encryption_tag &&
    connection.key_version
  ) {
    try {
      apiKey = decryptPaymentSecret({
        encrypted_secret: connection.encrypted_secret,
        encryption_iv: connection.encryption_iv,
        encryption_tag: connection.encryption_tag,
        key_version: connection.key_version,
      })
    } catch {
      apiKey = ""
    }
  }

  if (
    connection.encrypted_checksum &&
    connection.checksum_iv &&
    connection.checksum_tag &&
    connection.key_version
  ) {
    try {
      checksumKey = decryptPaymentSecret({
        encrypted_secret: connection.encrypted_checksum,
        encryption_iv: connection.checksum_iv,
        encryption_tag: connection.checksum_tag,
        key_version: connection.key_version,
      })
    } catch {
      checksumKey = ""
    }
  }

  const config = (typeof connection.configuration === "string"
    ? JSON.parse(connection.configuration)
    : connection.configuration) || {}

  const resolved: PayosFullSettings = {
    client_id: String(config.client_id || DEFAULT_SETTINGS.client_id),
    api_key: apiKey || DEFAULT_SETTINGS.api_key,
    checksum_key: checksumKey || DEFAULT_SETTINGS.checksum_key,
    environment:
      connection.environment === "PRODUCTION" ? "production" : "sandbox",
    is_enabled: connection.is_enabled,
    is_timeout_enabled: Boolean(config.is_timeout_enabled ?? DEFAULT_SETTINGS.is_timeout_enabled),
    timeout_minutes: Number(config.timeout_minutes || DEFAULT_SETTINGS.timeout_minutes),
    display_title: String(config.display_title || DEFAULT_SETTINGS.display_title),
    order_prefix: String(config.order_prefix || DEFAULT_SETTINGS.order_prefix),
    updated_at: typeof connection.updated_at === "string" 
      ? connection.updated_at 
      : connection.updated_at?.toISOString(),
  }

  PaymentProviderRegistry.set({
    code: "PAYOS",
    name: connection.name || "PayOS VietQR",
    providerId: connection.provider_id || "payos",
    environment: resolved.environment,
    isEnabled: resolved.is_enabled,
    configuration: config,
    secret: resolved.api_key,
    checksum: resolved.checksum_key,
    updatedAt: resolved.updated_at,
  })

  return resolved
}
