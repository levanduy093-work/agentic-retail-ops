import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { ensureGhnOrderFulfillmentWorkflow } from "../workflows/shipping-hub/ensure-ghn-order-fulfillment"

export default async function testFulfillment({ container }: ExecArgs) {
  const orderId = process.env.ORDER_ID
  if (!orderId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ORDER_ID is required"
    )
  }

  const { result } = await ensureGhnOrderFulfillmentWorkflow(container).run({
    input: { order_id: orderId },
  })

  console.log(JSON.stringify(result))
}
