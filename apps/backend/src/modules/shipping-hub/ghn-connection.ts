import type { MedusaContainer } from "@medusajs/framework/types"
import { ShippingCarrierRegistry } from "./carrier-registry"
import { decryptShippingSecret } from "./credential-vault"
import { SHIPPING_HUB_MODULE } from "."
import { GhnFullSettings, GhnSettingsStore } from "../ghn-fulfillment/services/ghn-settings-store"
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

export async function getGhnSettings(
  container?: Pick<MedusaContainer, "resolve"> | Record<string, unknown>
): Promise<GhnFullSettings> {
  const registered = ShippingCarrierRegistry.get("GHN")
  if (registered) {
    return GhnSettingsStore.getSettings()
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
    return GhnSettingsStore.getSettings()
  }

  try {
    const [connection] = (await shippingHub.listShippingCarrierConnections({
      code: "GHN",
    })) as StoredCarrier[]
    if (
      !connection ||
      !connection.is_enabled ||
      !connection.encrypted_secret ||
      !connection.encryption_iv ||
      !connection.encryption_tag ||
      !connection.key_version
    ) {
      return GhnSettingsStore.getSettings()
    }

    const secret = decryptShippingSecret({
      encrypted_secret: connection.encrypted_secret,
      encryption_iv: connection.encryption_iv,
      encryption_tag: connection.encryption_tag,
      key_version: connection.key_version,
    })
    const settings: GhnFullSettings = {
      ...GhnSettingsStore.getLegacySettings(),
      ...(connection.configuration as Partial<GhnFullSettings>),
      api_token: secret,
      environment:
        connection.environment === "PRODUCTION" ? "production" : "sandbox",
      updated_at: connection.updated_at.toISOString(),
    }

    GhnSettingsStore.setRuntimeSettings(settings)

    ShippingCarrierRegistry.set({
      code: "GHN",
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
    return GhnSettingsStore.getSettings()
  }
}
