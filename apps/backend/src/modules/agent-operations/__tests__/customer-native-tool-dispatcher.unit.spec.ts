import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createCustomerSupportNativeToolDispatcher,
  CUSTOMER_SUPPORT_NATIVE_TOOLS,
} from "../customer-native-tool-dispatcher"

function createService() {
  return {
    proposeCustomerDraftCart: jest.fn(async () => ({
      approval: { id: "agappr_1" },
      duplicate: false,
      incident: { id: "aginc_1" },
      recommendation: { id: "agrec_1" },
    })),
    proposeCustomerReturnReview: jest.fn(async () => ({
      duplicate: false,
      incident: { id: "aginc_return_1" },
      task: { id: "agtask_return_1" },
    })),
    recordCustomerReadToolCall: jest.fn(async () => ({ duplicate: false })),
    searchGovernedKnowledge: jest.fn(async () => ({
      results: [
        {
          citation_locator: "policy://returns#1",
          document_id: "doc_returns",
          document_key: "returns-policy",
          effective_at: "2026-01-01T00:00:00.000Z",
          excerpt: "Returns are accepted within seven days.",
          quote_checksum: "checksum_1",
          score: 0.95,
          title: "Returns Policy",
          version: "1.0",
        },
      ],
      total_candidates: 1,
    })),
  }
}

describe("customer native tool dispatcher", () => {
  it("exposes bounded read tools plus governed cart and return proposals", () => {
    expect(CUSTOMER_SUPPORT_NATIVE_TOOLS.map((tool) => tool.name)).toEqual([
      "estimate_shipping_delivery",
      "search_orders",
      "search_catalog",
      "propose_return_review",
      "propose_order_cancellation",
      "propose_address_change",
      "check_realtime_stock",
      "search_knowledge_base",
      "check_order_status",
      "check_delivery_status",
      "propose_draft_cart",
    ])
  })

  it("locks knowledge search to the current tenant and customer-support scope", async () => {
    const service = createService()
    const execute = createCustomerSupportNativeToolDispatcher({
      container: {} as MedusaContainer,
      conversation_id: "agconv_1",
      customer_id: "cus_1",
      inbound_message_id: "agmsg_1",
      locale: "vi",
      service,
      tenant_id: "tenant_a",
    })

    const output = await execute({
      arguments: { query: "chính sách đổi trả" },
      id: "call_1",
      name: "search_knowledge_base",
    })

    expect(service.searchGovernedKnowledge).toHaveBeenCalledWith({
      limit: 5,
      locale: "vi",
      query: "chính sách đổi trả",
      scope: "customer_support",
      tenant_id: "tenant_a",
    })
    expect(service.recordCustomerReadToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "agconv_1",
        inbound_message_id: "agmsg_1",
        tool_name: "knowledge.search",
      })
    )
    expect(output).toMatchObject({ total_candidates: 1 })
  })

  it("never queries an order when the customer identity is not verified", async () => {
    const service = createService()
    const execute = createCustomerSupportNativeToolDispatcher({
      container: {
        resolve: jest.fn(() => {
          throw new Error("Order query must not run")
        }),
      } as unknown as MedusaContainer,
      conversation_id: "agconv_1",
      customer_id: null,
      inbound_message_id: "agmsg_1",
      locale: "vi",
      service,
      tenant_id: "tenant_a",
    })

    await expect(
      execute({
        arguments: { order_code: "1024" },
        id: "call_2",
        name: "check_order_status",
      })
    ).resolves.toEqual({ display_id: 1024, status: "ACCOUNT_NOT_LINKED" })
    expect(service.recordCustomerReadToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { display_id: 1024 },
        output: { display_id: 1024, status: "ACCOUNT_NOT_LINKED" },
        tool_name: "order.read",
      })
    )
  })

  it("never reads delivery details when the customer identity is not verified", async () => {
    const service = createService()
    const execute = createCustomerSupportNativeToolDispatcher({
      container: {
        resolve: jest.fn(() => {
          throw new Error("Delivery query must not run")
        }),
      } as unknown as MedusaContainer,
      conversation_id: "agconv_1",
      customer_id: null,
      inbound_message_id: "agmsg_1",
      locale: "vi",
      service,
      tenant_id: "tenant_a",
    })

    await expect(
      execute({
        arguments: { order_code: "1024" },
        id: "call_delivery_1",
        name: "check_delivery_status",
      })
    ).resolves.toEqual({ display_id: 1024, status: "ACCOUNT_NOT_LINKED" })
    expect(service.recordCustomerReadToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ tool_name: "fulfillment.read" })
    )
  })

  it("rejects tools that are not explicitly exposed to customer support", async () => {
    const execute = createCustomerSupportNativeToolDispatcher({
      container: {} as MedusaContainer,
      conversation_id: "agconv_1",
      customer_id: "cus_1",
      inbound_message_id: "agmsg_1",
      locale: "vi",
      service: createService(),
      tenant_id: "tenant_a",
    })

    await expect(
      execute({
        arguments: {},
        id: "call_unsafe",
        name: "create_draft_cart",
      })
    ).rejects.toThrow("is not available")
  })

  it("binds a draft-cart proposal to the current confirmation message", async () => {
    const service = createService()
    const execute = createCustomerSupportNativeToolDispatcher({
      container: {} as MedusaContainer,
      conversation_id: "agconv_1",
      customer_id: "cus_1",
      inbound_message_id: "agmsg_1",
      locale: "vi",
      service,
      tenant_id: "tenant_a",
    })

    await expect(
      execute({
        arguments: {
          conversation_id: "agconv_other",
          customer_confirmation_message_id: "agmsg_1",
          items: [{ quantity: 1, variant_id: "variant_1" }],
          region_id: "reg_1",
          sales_channel_id: "sc_1",
        },
        id: "call_3",
        name: "propose_draft_cart",
      })
    ).rejects.toThrow("current conversation")

    await expect(
      execute({
        arguments: {
          conversation_id: "agconv_1",
          customer_confirmation_message_id: "agmsg_1",
          items: [{ quantity: 1, variant_id: "variant_1" }],
          region_id: "reg_1",
          sales_channel_id: "sc_1",
        },
        id: "call_4",
        name: "propose_draft_cart",
      })
    ).resolves.toMatchObject({ outcome: "PENDING_MANAGER_APPROVAL" })
    expect(service.proposeCustomerDraftCart).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "agconv_1",
        customer_confirmation_message_id: "agmsg_1",
      })
    )
  })

  it("binds a return proposal to the current verified customer request", async () => {
    const service = createService()
    const execute = createCustomerSupportNativeToolDispatcher({
      container: {} as MedusaContainer,
      conversation_id: "agconv_1",
      customer_id: "cus_1",
      inbound_message_id: "agmsg_1",
      locale: "vi",
      service,
      tenant_id: "tenant_a",
    })

    await expect(
      execute({
        arguments: {
          conversation_id: "agconv_1",
          customer_confirmation_message_id: "agmsg_other",
          order_code: "1024",
          reason: "Sản phẩm giao không đúng màu đã đặt.",
          requested_resolution: "EXCHANGE",
        },
        id: "call_return_1",
        name: "propose_return_review",
      })
    ).rejects.toThrow("current conversation")

    await expect(
      execute({
        arguments: {
          conversation_id: "agconv_1",
          customer_confirmation_message_id: "agmsg_1",
          order_code: "1024",
          reason: "Sản phẩm giao không đúng màu đã đặt.",
          requested_resolution: "EXCHANGE",
        },
        id: "call_return_2",
        name: "propose_return_review",
      })
    ).resolves.toEqual({
      duplicate: false,
      incident_id: "aginc_return_1",
      outcome: "PENDING_HUMAN_REVIEW",
      task_id: "agtask_return_1",
    })
    expect(service.proposeCustomerReturnReview).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "agconv_1",
        customer_confirmation_message_id: "agmsg_1",
        order_code: 1024,
      })
    )
  })

  it("dispatches search_orders by phone or email", async () => {
    const service = createService()
    const mockGraph = jest.fn().mockResolvedValue({
      data: [
        {
          canceled_at: null,
          created_at: new Date("2026-08-20T10:00:00Z"),
          currency_code: "vnd",
          customer_id: "cus_1",
          display_id: 1005,
          email: "customer@example.com",
          fulfillment_status: "shipped",
          id: "order_1005",
          items: [
            {
              id: "item_1",
              product_title: "Áo Polo Pima",
              quantity: 1,
              thumbnail: null,
              unit_price: 299000,
              variant_title: "Đen / Size M",
            },
          ],
          payment_status: "captured",
          shipping_address: {
            phone: "0912345678",
          },
          status: "completed",
          total: 299000,
        },
      ],
      metadata: { count: 1 },
    })

    const container = {
      resolve: jest.fn(() => ({ graph: mockGraph })),
    } as any

    const execute = createCustomerSupportNativeToolDispatcher({
      container,
      conversation_id: "agconv_1",
      customer_id: "cus_1",
      inbound_message_id: "agmsg_1",
      locale: "vi",
      service: service as never,
      tenant_id: "tenant_default",
    })

    const result = await execute({
      arguments: { phone: "0912345678" },
      id: "call_search_order",
      name: "search_orders",
    })

    expect(result).toMatchObject({
      orders: [
        expect.objectContaining({
          display_id: 1005,
          order_id: "order_1005",
        }),
      ],
      total_count: 1,
    })
    expect(service.recordCustomerReadToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_name: "order.search",
      })
    )
  })
})
