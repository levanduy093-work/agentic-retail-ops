import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PAYMENT_HUB_MODULE } from "../../modules/payment-hub"
import type PaymentHubModuleService from "../../modules/payment-hub/service"
import {
  encryptPaymentSecret,
  buildSecretHint,
} from "../../modules/payment-hub/credential-vault"
import { PaymentProviderRegistry } from "../../modules/payment-hub/provider-registry"
import type { ConfigureSepayProviderType } from "../../api/admin/payments/providers/validators"

export const configureSepayProviderStep = createStep(
  "configure-sepay-provider",
  async (input: ConfigureSepayProviderType, { container }) => {
    const paymentHub = container.resolve<PaymentHubModuleService>(
      PAYMENT_HUB_MODULE
    )

    const [existing] = (await paymentHub.listPaymentProviderConnections({
      code: "SEPAY",
    })) as any[]

    let encryptedSecret = existing?.encrypted_secret ?? null
    let encryptionIv = existing?.encryption_iv ?? null
    let encryptionTag = existing?.encryption_tag ?? null
    let keyVersion = existing?.key_version ?? null
    let secretHint = existing?.secret_hint ?? null

    if (input.api_key && input.api_key.trim()) {
      const encrypted = encryptPaymentSecret(input.api_key.trim())
      encryptedSecret = encrypted.encrypted_secret
      encryptionIv = encrypted.encryption_iv
      encryptionTag = encrypted.encryption_tag
      keyVersion = encrypted.key_version
      secretHint = buildSecretHint(input.api_key.trim())
    }

    const configuration = {
      ...(existing?.configuration || {}),
      account_number:
        input.account_number !== undefined
          ? input.account_number.trim()
          : existing?.configuration?.account_number || "",
      bank_code:
        input.bank_code !== undefined
          ? input.bank_code.trim().toUpperCase()
          : existing?.configuration?.bank_code || "MB",
      account_holder_name:
        input.account_holder_name !== undefined
          ? input.account_holder_name.trim()
          : existing?.configuration?.account_holder_name || "",
      is_timeout_enabled: input.is_timeout_enabled,
      timeout_minutes: input.timeout_minutes,
      display_title: input.display_title,
      order_prefix: input.order_prefix,
    }

    let connection: any
    const envEnum = input.environment === "production" ? "PRODUCTION" : "SANDBOX"

    if (existing) {
      connection = await paymentHub.updatePaymentProviderConnections({
        id: existing.id,
        name: "SePay VietQR",
        provider_id: "sepay",
        environment: envEnum,
        is_enabled: input.is_enabled,
        configuration,
        encrypted_secret: encryptedSecret,
        encryption_iv: encryptionIv,
        encryption_tag: encryptionTag,
        key_version: keyVersion,
        secret_hint: secretHint,
      })
    } else {
      connection = await paymentHub.createPaymentProviderConnections({
        code: "SEPAY",
        name: "SePay VietQR",
        provider_id: "sepay",
        environment: envEnum,
        is_enabled: input.is_enabled,
        configuration,
        encrypted_secret: encryptedSecret,
        encryption_iv: encryptionIv,
        encryption_tag: encryptionTag,
        key_version: keyVersion,
        secret_hint: secretHint,
      })
    }

    PaymentProviderRegistry.remove("SEPAY")

    // Active Gateway Switch: If SePay is enabled, deactivate PayOS
    if (input.is_enabled) {
      try {
        const [payosConn] = (await paymentHub.listPaymentProviderConnections({
          code: "PAYOS",
        })) as any[]
        if (payosConn && payosConn.is_enabled) {
          await paymentHub.updatePaymentProviderConnections({
            id: payosConn.id,
            is_enabled: false,
          })
          PaymentProviderRegistry.remove("PAYOS")
        }
      } catch {
        // Ignore errors
      }

      try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const link = container.resolve(ContainerRegistrationKeys.LINK)
        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id", "payment_providers.*"],
        })
        for (const region of regions) {
          const hasSepay = (region as any).payment_providers?.some(
            (p: any) => p.id === "pp_sepay_sepay"
          )
          if (!hasSepay) {
            await link.create({
              [Modules.REGION]: {
                region_id: region.id,
              },
              [Modules.PAYMENT]: {
                payment_provider_id: "pp_sepay_sepay",
              },
            })
          }

          // Dismiss PayOS so only 1 VietQR provider is active on checkout
          const hasPayos = (region as any).payment_providers?.some(
            (p: any) => p.id === "pp_payos_payos"
          )
          if (hasPayos) {
            await link.dismiss({
              [Modules.REGION]: {
                region_id: region.id,
              },
              [Modules.PAYMENT]: {
                payment_provider_id: "pp_payos_payos",
              },
            })
          }
        }
      } catch {
        // Fall through
      }
    } else {
      // If SePay is disabled, unlink from regions
      try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const link = container.resolve(ContainerRegistrationKeys.LINK)
        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id", "payment_providers.*"],
        })
        for (const region of regions) {
          const hasSepay = (region as any).payment_providers?.some(
            (p: any) => p.id === "pp_sepay_sepay"
          )
          if (hasSepay) {
            await link.dismiss({
              [Modules.REGION]: {
                region_id: region.id,
              },
              [Modules.PAYMENT]: {
                payment_provider_id: "pp_sepay_sepay",
              },
            })
          }
        }
      } catch {
        // Fall through
      }
    }

    const result = {
      code: "SEPAY",
      name: "SePay VietQR",
      provider_id: "sepay",
      environment: input.environment,
      is_enabled: input.is_enabled,
      is_timeout_enabled: input.is_timeout_enabled,
      timeout_minutes: input.timeout_minutes,
      display_title: input.display_title,
      order_prefix: input.order_prefix,
      account_number: configuration.account_number,
      bank_code: configuration.bank_code,
      account_holder_name: configuration.account_holder_name,
      has_api_key: Boolean(encryptedSecret),
      api_key_hint: secretHint,
      last_verified_at: connection.last_verified_at,
      last_verification: connection.last_verification,
      updated_at: connection.updated_at,
    }

    return new StepResponse(result, existing)
  }
)

export const configureSepayProviderWorkflow = createWorkflow(
  "configure-sepay-provider",
  function (input: ConfigureSepayProviderType) {
    const result = configureSepayProviderStep(input)
    return new WorkflowResponse(result)
  }
)
