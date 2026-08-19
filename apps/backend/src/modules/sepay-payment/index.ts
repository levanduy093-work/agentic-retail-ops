import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SepayPaymentProviderService from "./services/sepay-provider"

export default ModuleProvider(Modules.PAYMENT, {
  services: [SepayPaymentProviderService],
})
