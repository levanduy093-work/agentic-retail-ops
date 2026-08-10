import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { assignOrderSlaWorkflow } from "../workflows/agent-operations/assign-order-sla"

type OrderPlacedEventData = {
  id: string
}

export default async function assignOrderSlaOnPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderPlacedEventData>) {
  if (process.env.ORDER_SLA_ASSIGNMENT_ENABLED === "false") {
    return
  }

  await assignOrderSlaWorkflow(container).run({
    input: {
      order_id: data.id,
      source: "order-placed-event",
    },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
