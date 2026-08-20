import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createCustomerSupportNativeToolDispatcher,
  CUSTOMER_SUPPORT_NATIVE_TOOLS,
} from "../customer-native-tool-dispatcher"

function createService() {
  return {
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
  it("exposes only the three bounded read tools", () => {
    expect(CUSTOMER_SUPPORT_NATIVE_TOOLS.map((tool) => tool.name)).toEqual([
      "search_catalog",
      "search_knowledge_base",
      "check_order_status",
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
})
