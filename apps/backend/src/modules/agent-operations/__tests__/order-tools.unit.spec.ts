import {
  ORDER_READ_TOOL,
  toOrderReadOutput,
} from "../tools/order-tools"

describe("order.read tool", () => {
  test("normalizes a Medusa order detail into a bounded snapshot", () => {
    const snapshot = toOrderReadOutput({
      canceled_at: null,
      created_at: "2026-08-10T00:00:00.000Z",
      currency_code: "vnd",
      display_id: 42,
      fulfillment_status: "not_fulfilled",
      fulfillments: [],
      id: "order_42",
      items: [{ quantity: 2 }],
      payment_collections: [{ id: "paycol_1" }],
      payment_status: "awaiting",
      status: "pending",
      total: 250000,
      updated_at: "2026-08-10T00:10:00.000Z",
      version: 3,
    } as never)

    expect(snapshot).toEqual({
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
    })
    expect(ORDER_READ_TOOL).toMatchObject({
      approval_required: false,
      kind: "READ",
      name: "order.read",
      permission: "agent_order:read",
      risk_level: "READ_ONLY",
    })
  })
})
