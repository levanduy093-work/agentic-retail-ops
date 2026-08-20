import {
  FULFILLMENT_READ_TOOL,
  toFulfillmentReadOutput,
} from "../tools/fulfillment-tools"
import { PAYMENT_READ_TOOL, toPaymentReadOutput } from "../tools/payment-tools"

describe("customer fulfillment and payment read tools", () => {
  const order = {
    created_at: "2026-08-20T00:00:00.000Z",
    currency_code: "vnd",
    display_id: 42,
    fulfillment_status: "partially_fulfilled",
    fulfillments: [
      {
        data: {
          ghn_current_status: "shipping",
          tracking_number: "GHN_42",
          tracking_url: "https://donhang.ghn.vn/?order_code=GHN_42",
        },
        id: "ful_42",
        provider_id: "ghn_ghn",
        shipped_at: "2026-08-20T01:00:00.000Z",
      },
    ],
    id: "order_42",
    payment_collections: [{ id: "paycol_42" }],
    payment_status: "captured",
    total: 250000,
    updated_at: "2026-08-20T02:00:00.000Z",
    version: 3,
  } as never

  it("returns only bounded public tracking facts", () => {
    expect(toFulfillmentReadOutput(order)).toMatchObject({
      display_id: 42,
      fulfillment_status: "partially_fulfilled",
      fulfillments: [
        {
          carrier: "ghn_ghn",
          current_status: "shipping",
          fulfillment_id: "ful_42",
          tracking_number: "GHN_42",
        },
      ],
    })
    expect(FULFILLMENT_READ_TOOL).toMatchObject({
      kind: "READ",
      name: "fulfillment.read",
      permission: "agent_fulfillment:read",
      risk_level: "READ_ONLY",
    })
  })

  it("returns payment status without provider credentials", () => {
    expect(toPaymentReadOutput(order)).toMatchObject({
      display_id: 42,
      payment_collection_count: 1,
      payment_status: "captured",
      total: 250000,
    })
    expect(PAYMENT_READ_TOOL).toMatchObject({
      kind: "READ",
      name: "payment.read",
      permission: "agent_payment:read",
      risk_level: "READ_ONLY",
    })
  })
})
