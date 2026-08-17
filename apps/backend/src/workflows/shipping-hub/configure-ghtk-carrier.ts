import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { ShippingCarrierRegistry } from "../../modules/shipping-hub/carrier-registry"
import {
  decryptShippingSecret,
  encryptShippingSecret,
} from "../../modules/shipping-hub/credential-vault"
import { SHIPPING_HUB_MODULE } from "../../modules/shipping-hub"
import type { PackagingProfile } from "../../modules/shipping-hub/packing-profile"
import { GhtkSettingsStore } from "../../modules/ghtk-fulfillment/services/ghtk-settings-store"
import type ShippingHubModuleService from "../../modules/shipping-hub/service"

export type ConfigureGhtkCarrierInput = {
  api_token?: string
  base_url?: string
  default_height?: number
  default_length?: number
  default_weight?: number
  default_width?: number
  environment?: "sandbox" | "production"
  is_enabled?: boolean
  is_freeship?: boolean
  pick_address_id?: string
  sender_address?: string
  sender_district?: string
  sender_name?: string
  sender_phone?: string
  sender_province?: string
  sender_ward?: string
  transport?: "road" | "fly"
  verification?: Record<string, unknown>
}

type StoredCarrier = {
  code: string
  configuration: Record<string, unknown> | null
  encrypted_secret: string | null
  encryption_iv: string | null
  encryption_tag: string | null
  environment: "SANDBOX" | "PRODUCTION"
  id: string
  is_enabled: boolean
  key_version: string | null
  last_verification: Record<string, unknown> | null
  last_verified_at: Date | null
  name: string
  provider_id: string
  secret_hint: string | null
  updated_at: Date
}

function publicCarrier(connection: StoredCarrier) {
  const configuration = connection.configuration ?? {}

  return {
    code: connection.code,
    environment:
      connection.environment === "PRODUCTION" ? "production" : "sandbox",
    has_token: Boolean(connection.encrypted_secret),
    is_enabled: connection.is_enabled,
    last_verification: connection.last_verification,
    last_verified_at: connection.last_verified_at,
    name: connection.name,
    provider_id: connection.provider_id,
    secret_hint: connection.secret_hint,
    settings: configuration,
    updated_at: connection.updated_at,
  }
}

const configureGhtkCarrierStep = createStep(
  "configure-ghtk-carrier",
  async (input: ConfigureGhtkCarrierInput, { container }) => {
    const shippingHub = container.resolve<ShippingHubModuleService>(
      SHIPPING_HUB_MODULE
    )
    const [existing] = (await shippingHub.listShippingCarrierConnections({
      code: "GHTK",
    })) as StoredCarrier[]
    const connections = (await shippingHub.listShippingCarrierConnections()) as StoredCarrier[]
    const priorConfiguration = existing?.configuration ?? {}
    const sharedPackingProfile = connections.find(
      (connection) => connection.configuration?.packing_profile
    )?.configuration?.packing_profile as PackagingProfile | undefined
    const configuration = {
      ...(sharedPackingProfile ? { packing_profile: sharedPackingProfile } : {}),
      ...priorConfiguration,
      ...Object.fromEntries(
        Object.entries(input).filter(([key, value]) => {
          return (
            key !== "api_token" &&
            key !== "environment" &&
            key !== "is_enabled" &&
            key !== "verification" &&
            value !== undefined
          )
        })
      ),
    }
    const priorSecret =
      existing?.encrypted_secret &&
      existing.encryption_iv &&
      existing.encryption_tag &&
      existing.key_version
        ? decryptShippingSecret({
            encrypted_secret: existing.encrypted_secret,
            encryption_iv: existing.encryption_iv,
            encryption_tag: existing.encryption_tag,
            key_version: existing.key_version,
          })
        : ""
    const secret = input.api_token?.trim() || priorSecret

    if (!secret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "GHTK API Token is required before enabling the carrier."
      )
    }

    const encrypted = encryptShippingSecret(secret)
    const environment: "SANDBOX" | "PRODUCTION" =
      input.environment === "production" ? "PRODUCTION" : "SANDBOX"
    const isEnabled = input.is_enabled ?? existing?.is_enabled ?? true
    const payload = {
      code: "GHTK",
      configuration,
      ...encrypted,
      environment,
      is_enabled: isEnabled,
      last_verification:
        input.verification ?? existing?.last_verification ?? null,
      last_verified_at: input.verification
        ? new Date()
        : existing?.last_verified_at ?? null,
      name: "Giao Hàng Tiết Kiệm",
      provider_id: "ghtk_ghtk",
      secret_hint: `${secret.slice(0, 4)}••••${secret.slice(-4)}`,
    }
    const connection = existing
      ? await shippingHub.updateShippingCarrierConnections({
          id: existing.id,
          ...payload,
        })
      : await shippingHub.createShippingCarrierConnections(payload)
    const stored = connection as StoredCarrier

    GhtkSettingsStore.setRuntimeSettings({
      ...configuration,
      api_token: secret,
      environment: input.environment ?? "sandbox",
      updated_at: stored.updated_at?.toISOString(),
    })

    ShippingCarrierRegistry.set({
      code: stored.code,
      configuration,
      environment: input.environment ?? "sandbox",
      isEnabled,
      name: stored.name,
      providerId: stored.provider_id,
      secret,
      updatedAt: stored.updated_at?.toISOString(),
    })

    return new StepResponse(publicCarrier(stored))
  }
)

export const configureGhtkCarrierWorkflow = createWorkflow(
  "configure-ghtk-carrier",
  function (input: ConfigureGhtkCarrierInput) {
    const carrier = configureGhtkCarrierStep(input)
    return new WorkflowResponse(carrier)
  }
)
