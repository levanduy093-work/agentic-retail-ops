import type { MedusaContainer } from "@medusajs/framework/types"
import { ShippingCarrierRegistry } from "./carrier-registry"
import { decryptShippingSecret } from "./credential-vault"
import { SHIPPING_HUB_MODULE } from "."
import {
  GhtkFullSettings,
  GhtkSettingsStore,
} from "../ghtk-fulfillment/services/ghtk-settings-store"
import type ShippingHubModuleService from "./service"

type StoredCarrier = {
  configuration: Record<string, unknown> | null
  encrypted_secret: string | null
  encryption_iv: string | null
  encryption_tag: string | null
  environment: "SANDBOX" | "PRODUCTION"
  is_enabled: boolean
  key_version: string | null
  name: string
  provider_id: string
  updated_at: Date
}

export async function getGhtkSettings(
  container?: Pick<MedusaContainer, "resolve"> | Record<string, unknown>
): Promise<GhtkFullSettings> {
  const registered = ShippingCarrierRegistry.get("GHTK")
  if (registered) {
    return GhtkSettingsStore.getSettings()
  }

  let shippingHub: ShippingHubModuleService | undefined
  if (container) {
    try {
      if (typeof (container as any).resolve === "function") {
        shippingHub = (container as MedusaContainer).resolve<ShippingHubModuleService>(
          SHIPPING_HUB_MODULE
        )
      }
    } catch {
      shippingHub = (container as Record<string, unknown>)[
        SHIPPING_HUB_MODULE
      ] as ShippingHubModuleService | undefined
    }
  }

  if (!shippingHub) {
    return GhtkSettingsStore.getSettings()
  }

  try {
    const [connection] = (await shippingHub.listShippingCarrierConnections({
      code: "GHTK",
    })) as StoredCarrier[]
    if (
      !connection ||
      !connection.is_enabled ||
      !connection.encrypted_secret ||
      !connection.encryption_iv ||
      !connection.encryption_tag ||
      !connection.key_version
    ) {
      return GhtkSettingsStore.getSettings()
    }

    const secret = decryptShippingSecret({
      encrypted_secret: connection.encrypted_secret,
      encryption_iv: connection.encryption_iv,
      encryption_tag: connection.encryption_tag,
      key_version: connection.key_version,
    })
    const settings: GhtkFullSettings = {
      ...GhtkSettingsStore.getLegacySettings(),
      ...(connection.configuration as Partial<GhtkFullSettings>),
      api_token: secret,
      environment:
        connection.environment === "PRODUCTION" ? "production" : "sandbox",
      updated_at: connection.updated_at.toISOString(),
    }

    GhtkSettingsStore.setRuntimeSettings(settings)

    ShippingCarrierRegistry.set({
      code: "GHTK",
      configuration: connection.configuration ?? {},
      environment: settings.environment,
      isEnabled: true,
      name: connection.name,
      providerId: connection.provider_id,
      secret,
      updatedAt: settings.updated_at,
    })

    return settings
  } catch {
    return GhtkSettingsStore.getSettings()
  }
}
