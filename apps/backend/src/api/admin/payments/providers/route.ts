import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { PAYMENT_HUB_MODULE } from "../../../../modules/payment-hub"
import type PaymentHubModuleService from "../../../../modules/payment-hub/service"
import { buildSecretHint } from "../../../../modules/payment-hub/credential-vault"
import type { ConfigurePaymentProviderType } from "./validators"
import { getPayosSettings } from "../../../../modules/payment-hub/payos-connection"
import { getSepaySettings } from "../../../../modules/payment-hub/sepay-connection"
import { configurePayosProviderWorkflow } from "../../../../workflows/payments/configure-payos-provider"
import { configureSepayProviderWorkflow } from "../../../../workflows/payments/configure-sepay-provider"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const paymentHub = req.scope.resolve<PaymentHubModuleService>(
    PAYMENT_HUB_MODULE
  )
  const connections = (await paymentHub.listPaymentProviderConnections({})) as any[]

  const sepayConn = connections.find((c) => c.code === "SEPAY")
  const payosConn = connections.find((c) => c.code === "PAYOS")

  const defaultSepaySettings = await getSepaySettings(req.scope)
  const defaultPayosSettings = await getPayosSettings(req.scope)

  const sepayConfig = sepayConn?.configuration || {}
  const payosConfig = payosConn?.configuration || {}

  const sepayProvider = {
    code: "SEPAY",
    name: sepayConn?.name || "SePay VietQR",
    provider_id: sepayConn?.provider_id || "sepay",
    environment:
      sepayConn?.environment === "PRODUCTION" ? "production" : "sandbox",
    is_enabled: sepayConn ? Boolean(sepayConn.is_enabled) : defaultSepaySettings.is_enabled,
    is_timeout_enabled: Boolean(
      sepayConfig.is_timeout_enabled ?? defaultSepaySettings.is_timeout_enabled
    ),
    timeout_minutes: Number(
      sepayConfig.timeout_minutes || defaultSepaySettings.timeout_minutes
    ),
    display_title: String(
      sepayConfig.display_title || defaultSepaySettings.display_title
    ),
    order_prefix: String(
      sepayConfig.order_prefix || defaultSepaySettings.order_prefix
    ),
    account_number: String(
      sepayConfig.account_number || defaultSepaySettings.account_number
    ),
    bank_code: String(
      sepayConfig.bank_code || defaultSepaySettings.bank_code
    ),
    account_holder_name: String(
      sepayConfig.account_holder_name || defaultSepaySettings.account_holder_name
    ),
    has_api_key: Boolean(sepayConn?.encrypted_secret || defaultSepaySettings.api_key),
    api_key_hint: sepayConn?.secret_hint || buildSecretHint(defaultSepaySettings.api_key),
    last_verified_at: sepayConn?.last_verified_at || null,
    last_verification: sepayConn?.last_verification || null,
    updated_at: sepayConn?.updated_at || null,
  }

  const payosProvider = {
    code: "PAYOS",
    name: payosConn?.name || "PayOS VietQR",
    provider_id: payosConn?.provider_id || "payos",
    environment:
      payosConn?.environment === "PRODUCTION" ? "production" : "sandbox",
    is_enabled: payosConn ? Boolean(payosConn.is_enabled) : defaultPayosSettings.is_enabled,
    is_timeout_enabled: Boolean(
      payosConfig.is_timeout_enabled ?? defaultPayosSettings.is_timeout_enabled
    ),
    timeout_minutes: Number(
      payosConfig.timeout_minutes || defaultPayosSettings.timeout_minutes
    ),
    display_title: String(
      payosConfig.display_title || defaultPayosSettings.display_title
    ),
    order_prefix: String(
      payosConfig.order_prefix || defaultPayosSettings.order_prefix
    ),
    client_id: String(
      payosConfig.client_id || defaultPayosSettings.client_id
    ),
    has_api_key: Boolean(payosConn?.encrypted_secret || defaultPayosSettings.api_key),
    api_key_hint: payosConn?.secret_hint || buildSecretHint(defaultPayosSettings.api_key),
    has_checksum_key: Boolean(
      payosConn?.encrypted_checksum || defaultPayosSettings.checksum_key
    ),
    checksum_key_hint:
      payosConn?.checksum_hint || buildSecretHint(defaultPayosSettings.checksum_key),
    last_verified_at: payosConn?.last_verified_at || null,
    last_verification: payosConn?.last_verification || null,
    updated_at: payosConn?.updated_at || null,
  }

  const activeCode = sepayProvider.is_enabled
    ? "SEPAY"
    : payosProvider.is_enabled
    ? "PAYOS"
    : null

  const activeProvider = activeCode === "SEPAY" ? sepayProvider : payosProvider

  return res.json({
    providers: [sepayProvider, payosProvider],
    active_code: activeCode,
    provider: activeProvider,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<ConfigurePaymentProviderType>,
  res: MedusaResponse
) {
  const code = (req.validatedBody.code || "SEPAY").toUpperCase()

  if (code === "SEPAY") {
    const { result } = await configureSepayProviderWorkflow(req.scope).run({
      input: req.validatedBody,
    })
    return res.json({
      provider: result,
    })
  }

  const { result } = await configurePayosProviderWorkflow(req.scope).run({
    input: req.validatedBody as any,
  })

  return res.json({
    provider: result,
  })
}
