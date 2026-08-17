import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import GhtkFulfillmentProviderService from "./services/ghtk-fulfillment-provider"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [GhtkFulfillmentProviderService],
})
