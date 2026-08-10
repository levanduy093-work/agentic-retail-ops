import {
  buildOrderSlaEventId,
  detectOrderSlaException,
} from "../order-exception-detector"
import { OrderReadOutput } from "../tools/order-tools"

const now = new Date("2026-08-11T03:00:00.000Z")
const order: OrderReadOutput = {
  canceled_at: null,
  created_at: "2026-08-11T00:00:00.000Z",
  currency_code: "vnd",
  customer_id: "cus_1",
  display_id: 99,
  fulfillment_count: 0,
  fulfillment_status: "not_fulfilled",
  item_count: 1,
  order_id: "order_99",
  order_status: "pending",
  payment_collection_count: 0,
  payment_status: "not_paid",
  total: 99.99,
  updated_at: "2026-08-11T00:00:00.000Z",
  version: 1,
}

describe("order exception SLA detector", () => {
  test("does not infer an SLA when metadata is absent", () => {
    expect(detectOrderSlaException(order, {}, now)).toBeNull()
  })

  test("ignores a future deadline", () => {
    expect(
      detectOrderSlaException(
        order,
        { agent_payment_due_at: "2026-08-11T04:00:00.000Z" },
        now
      )
    ).toBeNull()
  })

  test("prioritizes an overdue unsettled payment", () => {
    const detected = detectOrderSlaException(
      order,
      {
        agent_fulfillment_due_at: "2026-08-11T01:00:00.000Z",
        agent_payment_due_at: "2026-08-11T02:00:00.000Z",
      },
      now
    )

    expect(detected).toMatchObject({
      due_at: "2026-08-11T02:00:00.000Z",
      exception_type: "PAYMENT_STUCK",
    })
    expect(buildOrderSlaEventId(order.order_id, detected!)).toBe(
      "order-sla:order_99:payment_stuck:2026-08-11T02:00:00.000Z"
    )
  })

  test("detects fulfillment after payment is settled", () => {
    expect(
      detectOrderSlaException(
        { ...order, payment_status: "captured" },
        {
          agent_fulfillment_due_at: "2026-08-11T01:00:00.000Z",
          agent_payment_due_at: "2026-08-11T02:00:00.000Z",
        },
        now
      )
    ).toMatchObject({ exception_type: "FULFILLMENT_OVERDUE" })
  })

  test("does not flag an authorized checkout payment", () => {
    expect(
      detectOrderSlaException(
        { ...order, payment_status: "authorized" },
        { agent_payment_due_at: "2026-08-11T02:00:00.000Z" },
        now
      )
    ).toBeNull()
  })

  test("ignores terminal orders", () => {
    expect(
      detectOrderSlaException(
        { ...order, order_status: "completed" },
        { agent_payment_due_at: "2026-08-11T02:00:00.000Z" },
        now
      )
    ).toBeNull()
  })
})
