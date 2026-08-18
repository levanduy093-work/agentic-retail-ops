import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { ensureGhnOrderFulfillmentWorkflow } from "../workflows/shipping-hub/ensure-ghn-order-fulfillment"

type OrderPlacedEventData = {
  id: string
}

export default async function createGhnFulfillmentOnOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<OrderPlacedEventData>) {
  if (process.env.GHN_AUTO_FULFILL_ON_ORDER_PLACED === "false") {
    return
  }

  await ensureGhnOrderFulfillmentWorkflow(container).run({
    input: { order_id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
