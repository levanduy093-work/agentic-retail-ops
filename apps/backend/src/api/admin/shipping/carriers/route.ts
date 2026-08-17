import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SHIPPING_HUB_MODULE } from "../../../../modules/shipping-hub"
import type ShippingHubModuleService from "../../../../modules/shipping-hub/service"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const shippingHub = req.scope.resolve<ShippingHubModuleService>(
    SHIPPING_HUB_MODULE
  )
  const connections = await shippingHub.listShippingCarrierConnections()

  res.json({
    carriers: connections.map((connection) => ({
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
      settings: connection.configuration,
      updated_at: connection.updated_at,
    })),
  })
}
