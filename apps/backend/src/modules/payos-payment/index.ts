import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PayosPaymentProviderService from "./services/payos-provider"

export default ModuleProvider(Modules.PAYMENT, {
  services: [PayosPaymentProviderService],
})
