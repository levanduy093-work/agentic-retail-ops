import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { GhnSettingsStore } from "../../modules/ghn-fulfillment/services/ghn-settings-store"
import { GhtkSettingsStore } from "../../modules/ghtk-fulfillment/services/ghtk-settings-store"
import { SHIPPING_HUB_MODULE } from "../../modules/shipping-hub"
import { normalizePackagingProfile, type PackagingProfile } from "../../modules/shipping-hub/packing-profile"
import type ShippingHubModuleService from "../../modules/shipping-hub/service"

export type ConfigurePackagingProfileInput = PackagingProfile

type StoredCarrier = {
  configuration: Record<string, unknown> | null
  id: string
}

const configurePackagingProfileStep = createStep(
  "configure-packaging-profile",
  async (input: ConfigurePackagingProfileInput, { container }) => {
    const shippingHub = container.resolve<ShippingHubModuleService>(
      SHIPPING_HUB_MODULE
    )
    const profile = normalizePackagingProfile(input)
    const connections = (await shippingHub.listShippingCarrierConnections()) as StoredCarrier[]

    await Promise.all(
      connections.map((connection) =>
        shippingHub.updateShippingCarrierConnections({
          id: connection.id,
          configuration: {
            ...(connection.configuration || {}),
            packing_profile: profile,
          },
        })
      )
    )

    GhnSettingsStore.setRuntimeSettings({
      ...GhnSettingsStore.getSettings(),
      packing_profile: profile,
    })
    GhtkSettingsStore.setRuntimeSettings({ packing_profile: profile })

    return new StepResponse(profile)
  }
)

export const configurePackagingProfileWorkflow = createWorkflow(
  "configure-packaging-profile",
  function (input: ConfigurePackagingProfileInput) {
    const profile = configurePackagingProfileStep(input)
    return new WorkflowResponse(profile)
  }
)
