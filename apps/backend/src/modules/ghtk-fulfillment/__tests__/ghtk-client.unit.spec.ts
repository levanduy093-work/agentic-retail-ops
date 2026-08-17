import { GhtkClient } from "../ghtk-client"

describe("GhtkClient", () => {
  let client: GhtkClient
  const originalFetch = global.fetch

  beforeEach(() => {
    client = new GhtkClient({
      apiToken: "test-token-ghtk",
      environment: "sandbox",
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should initialize with correct sandbox base URL", () => {
    expect(client.getConfig().baseUrl).toContain("services-staging.ghtklab.com")
    expect(client.getConfig().apiToken).toBe("test-token-ghtk")
  })

  it("should initialize with production URL when environment is production", () => {
    const prodClient = new GhtkClient({
      apiToken: "prod-token-ghtk",
      environment: "production",
    })
    expect(prodClient.getConfig().baseUrl).toContain("services.giaohangtietkiem.vn")
  })

  it("should calculate shipping fee correctly", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          fee: {
            delivery: true,
            delivery_type: "road",
            fee: 22000,
            include_vat: "1",
            insurance_fee: 0,
            name: "Giao hàng chuẩn",
          },
          message: "Success",
          success: true,
        }),
    }) as any

    const fee = await client.calculateFee({
      district: "Quận 1",
      province: "Hồ Chí Minh",
      weight: 500,
    })

    expect(fee.fee).toBe(22000)
    expect(fee.delivery).toBe(true)
  })

  it("should create order successfully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          message: "Tạo đơn hàng thành công",
          order: {
            area: "1",
            estimated_deliver_time: "2026-08-20",
            estimated_pick_time: "2026-08-18",
            fee: 22000,
            insurance_fee: 0,
            label: "S123456.MB01.123456",
            partner_id: "ORD-1001",
            status_id: 1,
            tracking_id: 99887766,
          },
          success: true,
        }),
    }) as any

    const order = await client.createOrder({
      order: {
        address: "123 Lê Duẩn",
        district: "Quận 1",
        id: "ORD-1001",
        name: "Nguyễn Văn A",
        province: "Hồ Chí Minh",
        tel: "0901234567",
      },
      products: [
        {
          name: "Áo Thun",
          price: 200000,
          quantity: 1,
          weight: 0.3,
        },
      ],
    })

    expect(order.label).toBe("S123456.MB01.123456")
    expect(order.partner_id).toBe("ORD-1001")
  })

  it("should test connection successfully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              address: "123 Lê Lợi, P. Bến Nghé, Q.1",
              pick_address_id: "pick_123",
              pick_name: "Kho Chính",
              pick_tel: "0900000000",
            },
          ],
          message: "Success",
          success: true,
        }),
    }) as any

    const result = await client.testConnection()
    expect(result.success).toBe(true)
    expect(result.pick_addresses_count).toBe(1)
  })

  it("should handle test connection failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          message: "Token không hợp lệ",
          success: false,
        }),
    }) as any

    const result = await client.testConnection()
    expect(result.success).toBe(false)
    expect(result.message).toContain("Token không hợp lệ")
  })

  it("should cancel order successfully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          message: "Hủy đơn hàng thành công",
          success: true,
        }),
    }) as any

    const result = await client.cancelOrder("S123456.MB01.123456")
    expect(result.success).toBe(true)
  })
})
