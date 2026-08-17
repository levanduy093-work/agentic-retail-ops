import { MedusaService } from "@medusajs/framework/utils"
import ShippingCarrierConnection from "./models/shipping-carrier-connection"
import ShippingWebhookEvent from "./models/shipping-webhook-event"

class ShippingHubModuleService extends MedusaService({
  ShippingCarrierConnection,
  ShippingWebhookEvent,
}) {}

export default ShippingHubModuleService
