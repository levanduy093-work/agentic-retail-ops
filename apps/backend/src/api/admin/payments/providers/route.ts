import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { PAYMENT_HUB_MODULE } from "../../../../modules/payment-hub"
import type PaymentHubModuleService from "../../../../modules/payment-hub/service"
import { buildSecretHint } from "../../../../modules/payment-hub/credential-vault"
import type { ConfigurePayosProviderType } from "./validators"
import { getPayosSettings } from "../../../../modules/payment-hub/payos-connection"
import { configurePayosProviderWorkflow } from "../../../../workflows/payments/configure-payos-provider"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const paymentHub = req.scope.resolve<PaymentHubModuleService>(
    PAYMENT_HUB_MODULE
  )
  const connections = (await paymentHub.listPaymentProviderConnections({
    code: "PAYOS",
  })) as any[]

  const connection = connections[0]
  if (!connection) {
    const defaultSettings = await getPayosSettings(req.scope)
    return res.json({
      provider: {
        code: "PAYOS",
        name: "PayOS VietQR",
        provider_id: "payos",
        environment: defaultSettings.environment,
        is_enabled: defaultSettings.is_enabled,
        is_timeout_enabled: defaultSettings.is_timeout_enabled,
        timeout_minutes: defaultSettings.timeout_minutes,
        display_title: defaultSettings.display_title,
        order_prefix: defaultSettings.order_prefix,
        client_id: defaultSettings.client_id,
        has_api_key: Boolean(defaultSettings.api_key),
        api_key_hint: buildSecretHint(defaultSettings.api_key),
        has_checksum_key: Boolean(defaultSettings.checksum_key),
        checksum_key_hint: buildSecretHint(defaultSettings.checksum_key),
        last_verified_at: null,
        last_verification: null,
        updated_at: null,
      },
    })
  }

  const config = connection.configuration || {}

  return res.json({
    provider: {
      code: connection.code,
      name: connection.name || "PayOS VietQR",
      provider_id: connection.provider_id || "payos",
      environment:
        connection.environment === "PRODUCTION" ? "production" : "sandbox",
      is_enabled: connection.is_enabled,
      is_timeout_enabled: Boolean(config.is_timeout_enabled ?? true),
      timeout_minutes: Number(config.timeout_minutes || 15),
      display_title: String(
        config.display_title || "VietQR / Chuyển khoản ngân hàng"
      ),
      order_prefix: String(config.order_prefix || "DH"),
      client_id: String(config.client_id || ""),
      has_api_key: Boolean(connection.encrypted_secret),
      api_key_hint: connection.secret_hint,
      has_checksum_key: Boolean(connection.encrypted_checksum),
      checksum_key_hint: connection.checksum_hint,
      last_verified_at: connection.last_verified_at,
      last_verification: connection.last_verification,
      updated_at: connection.updated_at,
    },
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<ConfigurePayosProviderType>,
  res: MedusaResponse
) {
  const { result } = await configurePayosProviderWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.json({
    provider: result,
  })
}
