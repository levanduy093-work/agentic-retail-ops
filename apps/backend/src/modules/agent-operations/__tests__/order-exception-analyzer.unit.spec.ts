import { analyzeOrderException } from "../order-exception-analyzer"
import { OrderReadOutput } from "../tools/order-tools"
import { OrderExceptionEventInput } from "../types"

const liveOrder: OrderReadOutput = {
  canceled_at: null,
  created_at: "2026-08-10T00:00:00.000Z",
  currency_code: "vnd",
  display_id: 42,
  fulfillment_count: 0,
  fulfillment_status: "not_fulfilled",
  item_count: 2,
  order_id: "order_42",
  order_status: "pending",
  payment_collection_count: 1,
  payment_status: "awaiting",
  total: 250000,
  updated_at: "2026-08-10T00:10:00.000Z",
  version: 3,
}

function event(
  exceptionType: OrderExceptionEventInput["payload"]["exception_type"]
): OrderExceptionEventInput {
  return {
    correlation_id: "order-42-exception",
    event_id: "exception-42",
    event_type: "order.exception",
    event_version: 1,
    occurred_at: "2026-08-10T00:15:00.000Z",
    payload: {
      detected_at: "2026-08-10T00:15:00.000Z",
      exception_type: exceptionType,
      order_id: "order_42",
    },
    source: "order-monitor",
    subject_id: "order_42",
    subject_type: "order",
    tenant_id: "default",
  }
}

describe("order exception analyzer", () => {
  test("creates a bounded payment review task from live state", () => {
    const result = analyzeOrderException(event("PAYMENT_STUCK"), liveOrder)

    expect(result).toMatchObject({
      action_type: "CREATE_TASK",
      proposal: {
        due_at: "2026-08-10T00:45:00.000Z",
        input: {
          exception_type: "PAYMENT_STUCK",
          order_id: "order_42",
          order_version: 3,
        },
        priority: "HIGH",
        task_type: "ORDER_PAYMENT_REVIEW",
      },
      risk_level: "HIGH",
    })
  })

  test("closes a stale exception without proposing a mutation", () => {
    const result = analyzeOrderException(event("PAYMENT_STUCK"), {
      ...liveOrder,
      payment_status: "captured",
    })

    expect(result).toMatchObject({
      action_type: "NO_ACTION",
      proposal: {},
      risk_level: "READ_ONLY",
      terminal_status: "RESOLVED",
    })
  })

  test("keeps partially shipped fulfillment under review", () => {
    const result = analyzeOrderException(event("FULFILLMENT_OVERDUE"), {
      ...liveOrder,
      fulfillment_status: "partially_shipped",
    })

    expect(result.action_type).toBe("CREATE_TASK")
  })
})
