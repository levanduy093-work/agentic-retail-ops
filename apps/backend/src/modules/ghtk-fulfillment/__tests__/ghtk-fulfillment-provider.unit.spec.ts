import GhtkFulfillmentProviderService from "../services/ghtk-fulfillment-provider"
import { GhtkSettingsStore } from "../services/ghtk-settings-store"

describe("GhtkFulfillmentProviderService", () => {
  let provider: GhtkFulfillmentProviderService
  const originalFetch = global.fetch

  beforeEach(() => {
    GhtkSettingsStore.setRuntimeSettings({
      ...GhtkSettingsStore.getLegacySettings(),
      api_token: "test-token-ghtk",
      environment: "sandbox",
      sender_district: "Quận 1",
      sender_province: "Hồ Chí Minh",
      sender_ward: "Phường Bến Nghé",
    })

    provider = new GhtkFulfillmentProviderService(
      {},
      {
        api_token: "test-token-ghtk",
      }
    )
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should return valid fulfillment options", async () => {
    const options = await provider.getFulfillmentOptions()
    expect(options.some((o) => o.id === "ghtk-road")).toBe(true)
    expect(options.some((o) => o.id === "ghtk-fly")).toBe(true)
    expect(options.some((o) => o.id === "ghtk-road-return")).toBe(true)
  })

  it("should calculate price accurately", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          fee: {
            delivery: true,
            delivery_type: "road",
            fee: 25000,
            include_vat: "1",
            insurance_fee: 0,
            name: "Giao hàng chuẩn",
          },
          message: "Success",
          success: true,
        }),
    }) as any

    const result = await provider.calculatePrice(
      { id: "ghtk-road" } as any,
      {},
      {
        items: [
          {
            quantity: 2,
            variant: { weight: 250 },
          },
        ],
        shipping_address: {
          city: "Quận 3",
          province: "Hồ Chí Minh",
        },
      } as any
    )

    expect(result.calculated_amount).toBe(25000)
    expect(result.is_calculated_price_tax_inclusive).toBe(true)
  })

  it("should create fulfillment and return tracking + label info", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          message: "Tạo đơn hàng thành công",
          order: {
            area: "1",
            estimated_deliver_time: "2026-08-20",
            estimated_pick_time: "2026-08-18",
            fee: 25000,
            insurance_fee: 0,
            label: "S123456.MB01.999999",
            partner_id: "ORD-1234",
            status_id: 1,
            tracking_id: 88776655,
          },
          success: true,
        }),
    }) as any

    const fulfillmentResult = await provider.createFulfillment(
      {},
      [
        {
          quantity: 1,
          title: "Sản phẩm A",
          unit_price: 200000,
          weight: 500,
        } as any,
      ],
      {
        display_id: 1234,
        id: "order_1234",
        shipping_address: {
          address_1: "456 Hai Bà Trưng",
          city: "Quận 1",
          first_name: "Anh",
          last_name: "Tuấn",
          phone: "0912345678",
          province: "Hồ Chí Minh",
        } as any,
      },
      {}
    )

    expect(fulfillmentResult.data.tracking_number).toBe("S123456.MB01.999999")
    expect(fulfillmentResult.data.carrier_code).toBe("GHTK")
    expect(fulfillmentResult.labels?.[0]?.tracking_number).toBe(
      "S123456.MB01.999999"
    )
    expect(fulfillmentResult.labels?.[0]?.label_url).toContain("services/label")
  })

  it("should cancel fulfillment successfully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          message: "Hủy đơn hàng thành công",
          success: true,
        }),
    }) as any

    const result = await provider.cancelFulfillment({
      ghtk_label_id: "S123456.MB01.999999",
    })

    expect(result.canceled).toBe(true)
    expect(result.ghtk_status_id).toBe(-1)
  })
})
