import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PaymentProviderRegistry } from "./provider-registry"
import { decryptPaymentSecret } from "./credential-vault"
import type PaymentHubModuleService from "./service"
import { PAYMENT_HUB_MODULE } from "./index"

export type SepayFullSettings = {
  api_key: string
  account_number: string
  bank_code: string
  account_holder_name: string
  environment: "sandbox" | "production"
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

const DEFAULT_SETTINGS: SepayFullSettings = {
  api_key: process.env.SEPAY_API_KEY || "",
  account_number: process.env.SEPAY_ACCOUNT_NUMBER || "",
  bank_code: process.env.SEPAY_BANK_CODE || "MB",
  account_holder_name: process.env.SEPAY_ACCOUNT_HOLDER_NAME || "",
  environment: (process.env.SEPAY_ENVIRONMENT as "sandbox" | "production") || "production",
  is_enabled: process.env.SEPAY_IS_ENABLED === "true",
  is_timeout_enabled: true,
  timeout_minutes: Number(process.env.SEPAY_TIMEOUT_MINUTES || "15"),
  display_title: "VietQR / Chuyển khoản ngân hàng",
  order_prefix: "DH",
}

export async function getSepaySettings(
  container?: Pick<MedusaContainer, "resolve"> | Record<string, unknown>
): Promise<SepayFullSettings> {
  const registered = PaymentProviderRegistry.get("SEPAY")
  if (registered) {
    const config = (typeof registered.configuration === "string"
      ? JSON.parse(registered.configuration)
      : registered.configuration) || {}
    return {
      api_key: registered.secret || DEFAULT_SETTINGS.api_key,
      account_number: String(config.account_number || DEFAULT_SETTINGS.account_number),
      bank_code: String(config.bank_code || DEFAULT_SETTINGS.bank_code),
      account_holder_name: String(config.account_holder_name || DEFAULT_SETTINGS.account_holder_name),
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
        code: "SEPAY",
      })) as StoredPaymentProvider[]
      connection = conn
    } catch {
      // Fall through to pgConnection
    }
  }

  if (!connection && pgConnection) {
    try {
      const rows = await pgConnection("payment_provider_connection")
        .where({ code: "SEPAY" })
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

  const config = (typeof connection.configuration === "string"
    ? JSON.parse(connection.configuration)
    : connection.configuration) || {}

  const resolved: SepayFullSettings = {
    api_key: apiKey || DEFAULT_SETTINGS.api_key,
    account_number: String(config.account_number || DEFAULT_SETTINGS.account_number),
    bank_code: String(config.bank_code || DEFAULT_SETTINGS.bank_code),
    account_holder_name: String(config.account_holder_name || DEFAULT_SETTINGS.account_holder_name),
    environment: connection.environment === "PRODUCTION" ? "production" : "sandbox",
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
    code: "SEPAY",
    name: connection.name || "SePay VietQR",
    providerId: connection.provider_id || "sepay",
    environment: resolved.environment,
    isEnabled: resolved.is_enabled,
    configuration: config,
    secret: resolved.api_key,
    checksum: "",
    updatedAt: resolved.updated_at,
  })

  return resolved
}
