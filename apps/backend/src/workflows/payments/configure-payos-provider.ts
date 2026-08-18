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
import type { ConfigurePayosProviderType } from "../../api/admin/payments/providers/validators"

export const configurePayosProviderStep = createStep(
  "configure-payos-provider",
  async (input: ConfigurePayosProviderType, { container }) => {
    const paymentHub = container.resolve<PaymentHubModuleService>(
      PAYMENT_HUB_MODULE
    )

    const [existing] = (await paymentHub.listPaymentProviderConnections({
      code: "PAYOS",
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

    let encryptedChecksum = existing?.encrypted_checksum ?? null
    let checksumIv = existing?.checksum_iv ?? null
    let checksumTag = existing?.checksum_tag ?? null
    let checksumHint = existing?.checksum_hint ?? null

    if (input.checksum_key && input.checksum_key.trim()) {
      const encrypted = encryptPaymentSecret(input.checksum_key.trim())
      encryptedChecksum = encrypted.encrypted_secret
      checksumIv = encrypted.encryption_iv
      checksumTag = encrypted.encryption_tag
      checksumHint = buildSecretHint(input.checksum_key.trim())
    }

    const configuration = {
      ...(existing?.configuration || {}),
      client_id:
        input.client_id !== undefined
          ? input.client_id.trim()
          : existing?.configuration?.client_id || "",
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
        name: "PayOS VietQR",
        provider_id: "payos",
        environment: envEnum,
        is_enabled: input.is_enabled,
        configuration,
        encrypted_secret: encryptedSecret,
        encryption_iv: encryptionIv,
        encryption_tag: encryptionTag,
        key_version: keyVersion,
        secret_hint: secretHint,
        encrypted_checksum: encryptedChecksum,
        checksum_iv: checksumIv,
        checksum_tag: checksumTag,
        checksum_hint: checksumHint,
      })
    } else {
      connection = await paymentHub.createPaymentProviderConnections({
        code: "PAYOS",
        name: "PayOS VietQR",
        provider_id: "payos",
        environment: envEnum,
        is_enabled: input.is_enabled,
        configuration,
        encrypted_secret: encryptedSecret,
        encryption_iv: encryptionIv,
        encryption_tag: encryptionTag,
        key_version: keyVersion,
        secret_hint: secretHint,
        encrypted_checksum: encryptedChecksum,
        checksum_iv: checksumIv,
        checksum_tag: checksumTag,
        checksum_hint: checksumHint,
      })
    }

    PaymentProviderRegistry.remove("PAYOS")

    if (input.is_enabled) {
      try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const link = container.resolve(ContainerRegistrationKeys.LINK)
        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id", "payment_providers.*"],
        })
        for (const region of regions) {
          const hasPayos = (region as any).payment_providers?.some(
            (p: any) => p.id === "pp_payos_payos"
          )
          if (!hasPayos) {
            await link.create({
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
    }

    const result = {
      code: "PAYOS",
      name: "PayOS VietQR",
      provider_id: "payos",
      environment: input.environment,
      is_enabled: input.is_enabled,
      is_timeout_enabled: input.is_timeout_enabled,
      timeout_minutes: input.timeout_minutes,
      display_title: input.display_title,
      order_prefix: input.order_prefix,
      client_id: configuration.client_id,
      has_api_key: Boolean(encryptedSecret),
      api_key_hint: secretHint,
      has_checksum_key: Boolean(encryptedChecksum),
      checksum_key_hint: checksumHint,
      last_verified_at: connection.last_verified_at,
      last_verification: connection.last_verification,
      updated_at: connection.updated_at,
    }

    return new StepResponse(result, existing)
  }
)

export const configurePayosProviderWorkflow = createWorkflow(
  "configure-payos-provider",
  function (input: ConfigurePayosProviderType) {
    const result = configurePayosProviderStep(input)
    return new WorkflowResponse(result)
  }
)
