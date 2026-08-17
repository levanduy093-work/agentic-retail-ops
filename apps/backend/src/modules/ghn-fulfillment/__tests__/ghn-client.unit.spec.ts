import { GhnClient } from "../ghn-client"

describe("GhnClient", () => {
  let client: GhnClient
  const originalFetch = global.fetch

  beforeEach(() => {
    client = new GhnClient({
      apiToken: "test-token-123",
      shopId: 123456,
      environment: "sandbox",
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should initialize with correct sandbox base URL", () => {
    expect(client.getConfig().baseUrl).toContain("dev-online-gateway.ghn.vn")
    expect(client.getConfig().apiToken).toBe("test-token-123")
    expect(client.getConfig().shopId).toBe(123456)
  })

  it("should initialize with production URL when environment is production", () => {
    const prodClient = new GhnClient({
      apiToken: "prod-token",
      shopId: 654321,
      environment: "production",
    })
    expect(prodClient.getConfig().baseUrl).toContain("online-gateway.ghn.vn")
    expect(prodClient.getConfig().baseUrl).not.toContain("dev-online-gateway")
  })

  it("should calculate shipping fee correctly", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        message: "Success",
        data: {
          total: 25000,
          service_fee: 25000,
          insurance_fee: 0,
          pick_station_fee: 0,
          coupon_value: 0,
          r2s_fee: 0,
          document_return: 0,
          double_check: 0,
        },
      }),
    }) as any

    const fee = await client.calculateFee({
      to_district_id: 1442,
      to_ward_code: "20101",
      weight: 500,
    })

    expect(fee.total).toBe(25000)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("should create shipping order correctly", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        message: "Success",
        data: {
          order_code: "GHN123456",
          sort_code: "HCM-01",
          trans_type: "truck",
          ward_encode: "20101",
          district_encode: "1442",
          fee: {
            main_service: 25000,
          },
          total_fee: 25000,
          expected_delivery_time: "2026-08-20T10:00:00Z",
        },
      }),
    }) as any

    const response = await client.createShippingOrder({
      to_name: "Nguyễn Văn A",
      to_phone: "0901234567",
      to_address: "123 Lê Lợi, P. Bến Nghé",
      to_district_id: 1442,
      to_ward_code: "20101",
      weight: 500,
      items: [
        {
          name: "Áo thun",
          quantity: 1,
          weight: 500,
        },
      ],
    })

    expect(response.order_code).toBe("GHN123456")
    expect(response.total_fee).toBe(25000)
  })

  it("should generate print URLs accurately", () => {
    const a5Url = client.getPrintUrl("TOKEN_ABC", "A5")
    const p80Url = client.getPrintUrl("TOKEN_ABC", "80x80")

    expect(a5Url).toBe("https://dev-online-gateway.ghn.vn/a5/public-api/printA5?token=TOKEN_ABC")
    expect(p80Url).toBe("https://dev-online-gateway.ghn.vn/a5/public-api/print80x80?token=TOKEN_ABC")
  })
})
