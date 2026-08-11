import { MedusaError } from "@medusajs/framework/utils"
import { SupportRequestEventInput } from "./types"
import { OrderReadOutput } from "./tools/order-tools"

export function assertSupportOrderAccess(
  input: SupportRequestEventInput,
  liveOrder: OrderReadOutput
) {
  if (
    input.subject_id !== input.payload.order_id ||
    liveOrder.order_id !== input.payload.order_id
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Support request subject, payload, and live order must reference the same order."
    )
  }

  if (liveOrder.customer_id !== input.payload.customer_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The support customer does not own the referenced order."
    )
  }
}
