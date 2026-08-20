import { extractNativeCustomerSupportContext } from "../native-customer-support-context"

describe("native customer support context", () => {
  it("passes only dispatcher-backed read results into the response pipeline", () => {
    const context = extractNativeCustomerSupportContext([
      {
        call_id: "call_catalog",
        name: "search_catalog",
        output: {
          products: [{ id: "prod_1" }],
          query: "áo polo",
          status: "READY",
          total_count: 1
        }
      },
      {
        call_id: "call_knowledge",
        name: "search_knowledge_base",
        output: { results: [], total_candidates: 0 }
      },
      {
        call_id: "call_order",
        name: "check_order_status",
        output: { display_id: 1024, status: "ACCOUNT_NOT_LINKED" }
      }
    ])

    expect(context.catalog_snapshot).toMatchObject({
      status: "READY",
      total_count: 1
    })
    expect(context.knowledge_snapshot).toEqual({
      results: [],
      total_candidates: 0
    })
    expect(context.customer_order_lookup).toEqual({
      display_id: 1024,
      status: "ACCOUNT_NOT_LINKED"
    })
  })

  it("does not trust an invalid tool output as customer context", () => {
    expect(
      extractNativeCustomerSupportContext([
        {
          call_id: "call_invalid",
          name: "search_catalog",
          output: { products: "not-an-array", status: "READY", total_count: 1 }
        }
      ])
    ).toEqual({})
  })
})
