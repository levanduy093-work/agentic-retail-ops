import assert from "node:assert/strict"
import { createOrderWorkflow } from "@medusajs/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"

export default async function prepareOrderDetectorRace({
  container,
}: ExecArgs) {
  const raceKey = process.env.ORDER_DETECTOR_RACE_KEY

  assert.ok(raceKey, "ORDER_DETECTOR_RACE_KEY is required")
  assert.equal(
    process.env.REDIS_INFRASTRUCTURE_ENABLED,
    "true",
    "Redis infrastructure must be enabled for the race verification"
  )

  const dueAt = new Date(Date.now() - 60_000).toISOString()
  const { result: order } = await createOrderWorkflow(container).run({
    input: {
      currency_code: "vnd",
      items: [
        {
          is_discountable: false,
          is_tax_inclusive: true,
          quantity: 1,
          requires_shipping: false,
          title: "Order detector Redis race verification item",
          unit_price: 99.99,
        },
      ],
      metadata: {
        agent_detector_race_key: raceKey,
        agent_payment_due_at: dueAt,
        purpose: "order-detector-redis-race-verification",
      },
      no_notification: true,
      status: "pending",
    },
  })

  console.log(
    JSON.stringify({
      due_at: dueAt,
      order_id: order.id,
      race_key: raceKey,
      status: "PREPARED",
    })
  )
}
