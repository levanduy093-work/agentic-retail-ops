import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ORDER_SEARCH_TOOL,
  OrderSearchInput,
  OrderSearchOutput,
} from "../tools/order-tools"
import { executeOrderSearch } from "../order-read-runtime"

describe("order.search tool", () => {
  test("validates input schema correctly", () => {
    const validByPhone = OrderSearchInput.parse({ phone: "0912345678" })
    expect(validByPhone.phone).toBe("0912345678")

    const validByEmail = OrderSearchInput.parse({ email: "customer@example.com" })
    expect(validByEmail.email).toBe("customer@example.com")

    const validByQuery = OrderSearchInput.parse({ query: "áo polo" })
    expect(validByQuery.query).toBe("áo polo")

    expect(ORDER_SEARCH_TOOL).toMatchObject({
      approval_required: false,
      kind: "READ",
      name: "order.search",
      permission: "agent_order:read",
      risk_level: "READ_ONLY",
    })
  })

  test("executes order search via Medusa query graph", async () => {
    const mockGraph = jest.fn().mockResolvedValue({
      data: [
        {
          canceled_at: null,
          created_at: new Date("2026-08-20T10:00:00Z"),
          currency_code: "vnd",
          customer_id: "cus_100",
          display_id: 1005,
          email: "test@example.com",
          fulfillment_status: "shipped",
          id: "order_1005",
          items: [
            {
              id: "item_1",
              product_title: "Áo Polo Pima",
              quantity: 1,
              thumbnail: "https://example.com/polo.jpg",
              unit_price: 299000,
              variant_title: "Đen / Size M",
            },
          ],
          payment_status: "captured",
          shipping_address: {
            address_1: "123 Đường Lê Lợi",
            city: "TP. Hồ Chí Minh",
            first_name: "Duy",
            last_name: "Lê",
            phone: "0912345678",
            province: "Quận 1",
          },
          status: "completed",
          total: 299000,
        },
      ],
      metadata: { count: 1 },
    })

    const mockContainer = {
      resolve: jest.fn((key: string) => {
        if (key === ContainerRegistrationKeys.QUERY) {
          return { graph: mockGraph }
        }
        return {}
      }),
    } as any

    const result = await executeOrderSearch(
      mockContainer,
      { phone: "0912345678" },
      "customer-support-agent"
    )

    expect(result.output.total_count).toBe(1)
    expect(result.output.orders).toHaveLength(1)
    expect(result.output.orders[0]).toMatchObject({
      display_id: 1005,
      fulfillment_status: "shipped",
      order_id: "order_1005",
      shipping_address: {
        phone: "0912345678",
      },
      total: 299000,
    })
    expect(result.output.orders[0].items[0].product_title).toBe("Áo Polo Pima")
  })
})
