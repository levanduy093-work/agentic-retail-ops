import { draftCustomerResponse } from "../tools/response-tools"

const order = {
  canceled_at: null,
  created_at: "2026-08-11T00:00:00.000Z",
  currency_code: "vnd",
  customer_id: "cus_1",
  display_id: 101,
  fulfillment_count: 0,
  fulfillment_status: "not_fulfilled",
  item_count: 1,
  order_id: "order_1",
  order_status: "pending",
  payment_collection_count: 1,
  payment_status: "authorized",
  total: 150_000,
  updated_at: "2026-08-11T00:01:00.000Z",
  version: 1,
}

describe("response.draft tool", () => {
  test("creates a cited draft that always requires human review", () => {
    const result = draftCustomerResponse({
      knowledge: [
        {
          citation_locator: "policy://shipping/1#status",
          document_id: "doc_1",
          document_key: "shipping-status",
          effective_at: "2026-08-01T00:00:00.000Z",
          excerpt: "Đơn đang xử lý sẽ được bàn giao cho đơn vị vận chuyển.",
          quote_checksum: "checksum",
          score: 8,
          title: "Chính sách giao hàng",
          version: "1.0.0",
        },
      ],
      locale: "vi",
      order,
      question: "Đơn của tôi đang ở đâu?",
      request_type: "ORDER_STATUS",
    })

    expect(result.grounded).toBe(true)
    expect(result.requires_human_review).toBe(true)
    expect(result.citations).toHaveLength(1)
    expect(result.body).toContain("#101")
  })

  test("fails safely when approved knowledge is unavailable", () => {
    const result = draftCustomerResponse({
      knowledge: [],
      locale: "vi",
      order,
      question: "Đơn của tôi đang ở đâu?",
      request_type: "ORDER_STATUS",
    })

    expect(result.grounded).toBe(false)
    expect(result.citations).toEqual([])
    expect(result.requires_human_review).toBe(true)
    expect(result.body).toContain("kiểm tra thủ công")
  })
})
