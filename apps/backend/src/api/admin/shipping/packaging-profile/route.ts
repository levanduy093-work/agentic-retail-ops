import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SHIPPING_HUB_MODULE } from "../../../../modules/shipping-hub"
import { DEFAULT_PACKAGING_PROFILE, normalizePackagingProfile } from "../../../../modules/shipping-hub/packing-profile"
import type ShippingHubModuleService from "../../../../modules/shipping-hub/service"
import { configurePackagingProfileWorkflow } from "../../../../workflows/shipping-hub/configure-packaging-profile"
import type { ConfigurePackagingProfile } from "../validators"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const shippingHub = req.scope.resolve<ShippingHubModuleService>(
    SHIPPING_HUB_MODULE
  )
  const connections = await shippingHub.listShippingCarrierConnections()
  const storedProfile = connections.find(
    (connection) => connection.configuration?.packing_profile
  )?.configuration?.packing_profile

  res.json({
    profile: normalizePackagingProfile(storedProfile || DEFAULT_PACKAGING_PROFILE),
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<ConfigurePackagingProfile>,
  res: MedusaResponse
) {
  const { result } = await configurePackagingProfileWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.json({ profile: result })
}
