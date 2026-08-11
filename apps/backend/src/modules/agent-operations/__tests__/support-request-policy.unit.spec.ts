import { assertSupportOrderAccess } from "../support-request-policy"
import { OrderReadOutput } from "../tools/order-tools"
import { SupportRequestEventInput } from "../types"

const order: OrderReadOutput = {
  canceled_at: null,
  created_at: "2026-08-11T00:00:00.000Z",
  currency_code: "vnd",
  customer_id: "cus_owner",
  display_id: 42,
  fulfillment_count: 0,
  fulfillment_status: "not_fulfilled",
  item_count: 1,
  order_id: "order_42",
  order_status: "pending",
  payment_collection_count: 0,
  payment_status: "not_paid",
  total: 100,
  updated_at: "2026-08-11T00:00:00.000Z",
  version: 1,
}

const request: SupportRequestEventInput = {
  correlation_id: "support-42",
  event_id: "support-42",
  event_type: "support.requested",
  event_version: 1,
  occurred_at: "2026-08-11T00:00:00.000Z",
  payload: {
    customer_id: "cus_owner",
    locale: "vi",
    order_id: "order_42",
    question: "Don hang cua toi dang o dau?",
    request_type: "ORDER_STATUS",
    requested_at: "2026-08-11T00:00:00.000Z",
  },
  source: "support-policy-test",
  subject_id: "order_42",
  subject_type: "order",
  tenant_id: "default",
}

describe("support request policy", () => {
  test("allows the owner to continue to knowledge and model execution", () => {
    expect(() => assertSupportOrderAccess(request, order)).not.toThrow()
  })

  test("rejects an ownership mismatch before external model execution", () => {
    expect(() =>
      assertSupportOrderAccess(
        {
          ...request,
          payload: { ...request.payload, customer_id: "cus_other" },
        },
        order
      )
    ).toThrow("does not own")
  })

  test("rejects inconsistent order references", () => {
    expect(() =>
      assertSupportOrderAccess(
        { ...request, subject_id: "order_other" },
        order
      )
    ).toThrow("must reference the same order")
  })
})
