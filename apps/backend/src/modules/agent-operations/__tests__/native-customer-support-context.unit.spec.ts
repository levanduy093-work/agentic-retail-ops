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
    expect(context.route).toBe("PRODUCT_DISCOVERY")
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

  it("replaces catalog availability only with a matching realtime-stock result", () => {
    const context = extractNativeCustomerSupportContext([
      {
        call_id: "call_catalog",
        name: "search_catalog",
        output: {
          products: [
            {
              id: "prod_1",
              variants: [
                {
                  availability: "IN_STOCK",
                  available_quantity: 8,
                  id: "variant_m",
                  manage_inventory: true,
                  title: "Size M",
                },
              ],
            },
          ],
          query: "áo polo",
          status: "READY",
          total_count: 1,
        },
      },
      {
        call_id: "call_stock",
        name: "check_realtime_stock",
        output: {
          product_id: "prod_1",
          requested_quantity: 1,
          status: "FOUND",
          variants: [
            {
              availability: "OUT_OF_STOCK",
              available_quantity: 0,
              id: "variant_m",
            },
          ],
        },
      },
    ])

    expect(context.catalog_snapshot?.products[0].variants[0]).toMatchObject({
      availability: "OUT_OF_STOCK",
      available_quantity: 0,
      id: "variant_m",
    })
  })

  it("routes a knowledge-only native trace without using keyword intent routing", () => {
    expect(
      extractNativeCustomerSupportContext([
        {
          call_id: "call_knowledge",
          name: "search_knowledge_base",
          output: { results: [], total_candidates: 0 },
        },
      ])
    ).toMatchObject({
      route: "STORE_QUESTION",
    })
  })

  it("preserves typed travel evidence and the travel-filtered live catalog", () => {
    const context = extractNativeCustomerSupportContext([
      {
        call_id: "call_location",
        name: "resolve_travel_location",
        output: {
          ambiguous: false,
          candidates: [],
          query: "Tokyo",
          source: "OPEN_METEO_GEOCODING",
          status: "FOUND",
        },
      },
      {
        call_id: "call_forecast",
        name: "get_weather_forecast",
        output: {
          evidence_kind: "FORECAST",
          fetched_at: "2026-08-23T00:00:00.000Z",
          location: {},
          source: "OPEN_METEO_FORECAST",
          status: "READY",
          weather_days: [],
        },
      },
      {
        call_id: "call_catalog",
        name: "search_catalog_by_attributes",
        output: { products: [{ id: "prod_1" }], query: "áo khoác", status: "READY", total_count: 1 },
      },
    ])

    expect(context).toMatchObject({
      catalog_snapshot: { status: "READY", total_count: 1 },
      route: "PRODUCT_DISCOVERY",
      travel_context: {
        forecast: { evidence_kind: "FORECAST", source: "OPEN_METEO_FORECAST" },
        location: { query: "Tokyo", source: "OPEN_METEO_GEOCODING" },
      },
    })
  })

  it("keeps owned live fulfillment with its verified order result", () => {
    expect(
      extractNativeCustomerSupportContext([
        {
          call_id: "call_delivery",
          name: "check_delivery_status",
          output: {
            display_id: 1024,
            fulfillment: {
              display_id: 1024,
              fulfillment_status: "shipped",
              fulfillments: [],
              order_id: "order_1",
              version: 1,
            },
            order: {
              display_id: 1024,
              fulfillment_status: "shipped",
              order_id: "order_1",
              order_status: "completed",
              payment_status: "captured",
              version: 1,
            },
            status: "FOUND",
          },
        },
      ])
    ).toMatchObject({
      customer_order_lookup: {
        display_id: 1024,
        fulfillment: { fulfillment_status: "shipped" },
        order: { order_id: "order_1" },
        status: "FOUND",
      },
    })
  })

  it("marks an existing governed proposal without creating a second escalation", () => {
    expect(
      extractNativeCustomerSupportContext([
        {
          call_id: "call_return",
          name: "propose_return_review",
          output: {
            outcome: "PENDING_HUMAN_REVIEW",
            task_id: "task_return_1",
          },
        },
      ])
    ).toMatchObject({
      proposal_result: {
        kind: "propose_return_review",
        outcome: "PENDING_HUMAN_REVIEW",
        task_id: "task_return_1",
      },
      route: "HUMAN_ACTION",
    })
  })
})
