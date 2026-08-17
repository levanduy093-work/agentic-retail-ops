import GhnFulfillmentProviderService from "../services/ghn-fulfillment-provider"
import { GhnSettingsStore } from "../services/ghn-settings-store"

describe("GhnFulfillmentProviderService", () => {
  let provider: GhnFulfillmentProviderService
  const originalFetch = global.fetch

  beforeEach(() => {
    GhnSettingsStore.setRuntimeSettings({
      ...GhnSettingsStore.getLegacySettings(),
      api_token: "test-token",
      shop_id: 123456,
      environment: "sandbox",
      sender_district_id: 1442,
      sender_ward_code: "20101",
    })

    provider = new GhnFulfillmentProviderService({}, {
      api_token: "test-token",
      shop_id: 123456,
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should return valid fulfillment options", async () => {
    const options = await provider.getFulfillmentOptions()
    expect(options.some((o) => o.id === "ghn-standard")).toBe(true)
    expect(options.some((o) => o.id === "ghn-standard-return")).toBe(true)
  })

  it("should calculate price accurately", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        message: "Success",
        data: {
          total: 32000,
          service_fee: 32000,
        },
      }),
    }) as any

    const result = await provider.calculatePrice(
      { id: "ghn-standard" } as any,
      {},
      {
        shipping_address: {
          metadata: {
            ghn_district_id: 1444,
            ghn_ward_code: "20308",
          },
        },
        items: [
          {
            quantity: 2,
            variant: { weight: 250 },
          },
        ],
      } as any
    )

    expect(result.calculated_amount).toBe(32000)
    expect(result.is_calculated_price_tax_inclusive).toBe(true)
  })

  it("should create fulfillment and return tracking + label info", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          message: "Success",
          data: {
            order_code: "GHN_ORD_999",
            total_fee: 30000,
            expected_delivery_time: "2026-08-20T10:00:00Z",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          message: "Success",
          data: {
            token: "PRINT_TOKEN_XYZ",
          },
        }),
      }) as any

    const fulfillmentResult = await provider.createFulfillment(
      {},
      [
        {
          title: "Sản phẩm A",
          quantity: 1,
          weight: 400,
        } as any,
      ],
      {
        display_id: 1001,
        shipping_address: {
          first_name: "Lê",
          last_name: "Duy",
          phone: "0912345678",
          address_1: "789 Đường CMT8",
          metadata: {
            ghn_district_id: 1442,
            ghn_ward_code: "20101",
          },
        } as any,
      } as any,
      {
        id: "ful_12345",
      } as any
    )

    expect(fulfillmentResult.data.ghn_order_code).toBe("GHN_ORD_999")
    expect(fulfillmentResult.data.ghn_print_token).toBe("PRINT_TOKEN_XYZ")
    expect(fulfillmentResult.labels?.[0]?.tracking_number).toBe("GHN_ORD_999")
  })
})
