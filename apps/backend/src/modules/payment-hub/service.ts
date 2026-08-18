import { MedusaService } from "@medusajs/framework/utils"
import PaymentProviderConnection from "./models/payment-provider-connection"

class PaymentHubModuleService extends MedusaService({
  PaymentProviderConnection,
}) {}

export default PaymentHubModuleService
