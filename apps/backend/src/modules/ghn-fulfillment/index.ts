import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import GhnFulfillmentProviderService from "./services/ghn-fulfillment-provider"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [GhnFulfillmentProviderService],
})
