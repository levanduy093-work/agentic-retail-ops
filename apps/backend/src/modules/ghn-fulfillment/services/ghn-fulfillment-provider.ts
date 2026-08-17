import {
  AbstractFulfillmentProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  CalculateShippingOptionPriceDTO,
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"
import { GhnClient } from "../ghn-client"
import { GhnSettingsStore } from "./ghn-settings-store"
import { VietnamAddressService } from "./vietnam-address-service"
import { getGhnSettings } from "../../shipping-hub/ghn-connection"

export type GhnProviderOptions = {
  api_token?: string
  shop_id?: number
  client_id?: number
  base_url?: string
  environment?: "sandbox" | "production"
}

export class GhnFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "ghn"

  protected options_: GhnProviderOptions
  private container_: any

  constructor(_container: unknown, options: GhnProviderOptions = {}) {
    // @ts-ignore Medusa injects the provider container at runtime.
    super(...arguments)
    this.options_ = options
    this.container_ = _container

    // Connection data is loaded by Shipping Hub from encrypted DB storage.
    // Options remain only as an explicit environment fallback for first install.
    if (!GhnSettingsStore.getSettings().api_token && options.api_token) {
      GhnSettingsStore.setRuntimeSettings({
        ...GhnSettingsStore.getLegacySettings(),
        api_token: options.api_token,
        shop_id: options.shop_id || 0,
        client_id: options.client_id,
        base_url: options.base_url,
        environment: options.environment || "sandbox",
      })
    }
  }

  private async getSettings() {
    return getGhnSettings(this.container_)
  }

  private async getClient(): Promise<GhnClient> {
    const settings = await this.getSettings()
    return new GhnClient({
      apiToken: settings.api_token,
      baseUrl: settings.base_url,
      clientId: settings.client_id,
      environment: settings.environment,
      shopId: settings.shop_id,
    })
  }

  async getFulfillmentOptions(): Promise<
    Array<{ id: string; name: string; is_return?: boolean }>
  > {
    return [
      {
        id: "ghn-standard",
        name: "Giao Hàng Nhanh - Chuẩn (Standard Delivery)",
      },
      {
        id: "ghn-standard-return",
        name: "Giao Hàng Nhanh - Trả hàng (Return Delivery)",
        is_return: true,
      },
    ]
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return data
  }

  async validateOption(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async canCalculate(_data: any): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    let settings
    let client: GhnClient
    try {
      settings = await this.getSettings()
      client = await this.getClient()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GHN connection could not be loaded: ${message}`
      )
    }

    const shippingAddress = (context as any)?.shipping_address || (context as any)?.cart?.shipping_address
    const items = (context as any)?.items || (context as any)?.cart?.items || []

    let toDistrictId: number | undefined =
      shippingAddress?.metadata?.ghn_district_id ||
      shippingAddress?.metadata?.district_id ||
      data?.to_district_id

    let toWardCode: string | undefined =
      shippingAddress?.metadata?.ghn_ward_code ||
      shippingAddress?.metadata?.ward_code ||
      data?.to_ward_code

    // Fallback: If not in metadata, try resolving from province / city text
    if (!toDistrictId && shippingAddress?.city) {
      let provinceId =
        shippingAddress?.metadata?.ghn_province_id ||
        shippingAddress?.metadata?.province_id

      if (!provinceId && shippingAddress?.province) {
        const provinces = await VietnamAddressService.getProvinces()
        const matchedProv = provinces.find(
          (p) =>
            p.ProvinceName.toLowerCase().includes(
              shippingAddress.province.toLowerCase()
            ) ||
            shippingAddress.province
              .toLowerCase()
              .includes(p.ProvinceName.toLowerCase())
        )
        if (matchedProv) provinceId = matchedProv.ProvinceID
      }

      if (provinceId) {
        const matchedDist = await VietnamAddressService.findDistrict(
          provinceId,
          shippingAddress.city
        )
        if (matchedDist) {
          toDistrictId = matchedDist.DistrictID
        }
      }
    }

    if (!toDistrictId || !toWardCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "GHN requires a delivery district and ward. Complete the Vietnam shipping address before choosing a shipping method."
      )
    }

    // Calculate total weight from items
    let totalWeight = 0
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemWeight =
          (item as any)?.variant?.weight ||
          (item as any)?.weight ||
          settings.default_weight
        const qty = item.quantity || 1
        totalWeight += itemWeight * qty
      }
    }
    if (totalWeight <= 0) {
      totalWeight = settings.default_weight
    }

    const serviceTypeId = 2

    try {
      const feeResponse = await client.calculateFee({
        from_district_id: settings.sender_district_id,
        from_ward_code: settings.sender_ward_code,
        to_district_id: Number(toDistrictId),
        to_ward_code: toWardCode ? String(toWardCode) : undefined,
        weight: totalWeight,
        length: settings.default_length,
        width: settings.default_width,
        height: settings.default_height,
        service_type_id: serviceTypeId,
      })

      return {
        calculated_amount: feeResponse.total,
        is_calculated_price_tax_inclusive: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GHN could not calculate the shipping fee: ${message}`
      )
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const settings = await this.getSettings()
    const client = await this.getClient()

    const shippingAddress = (order as any)?.shipping_address || (fulfillment as any)?.shipping_address
    if (!shippingAddress) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHN fulfillment without shipping address"
      )
    }

    const toDistrictId =
      shippingAddress?.metadata?.ghn_district_id ||
      data?.to_district_id
    const toWardCode =
      shippingAddress?.metadata?.ghn_ward_code ||
      data?.to_ward_code

    if (!toDistrictId || !toWardCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "GHN fulfillment requires the destination district and ward selected at checkout."
      )
    }

    const recipientName =
      [shippingAddress.first_name, shippingAddress.last_name]
        .filter(Boolean)
        .join(" ") || "Khách hàng"
    const recipientPhone = shippingAddress.phone || "0900000000"
    const recipientAddress =
      [
        shippingAddress.address_1,
        shippingAddress.address_2,
        shippingAddress.city,
        shippingAddress.province,
      ]
        .filter(Boolean)
        .join(", ") || "Địa chỉ nhận hàng"

    let totalWeight = 0
    const ghnItems = (items || []).map((item: any) => {
      const w = item.item?.variant?.weight || item.weight || settings.default_weight
      const qty = item.quantity || 1
      totalWeight += w * qty
      return {
        name: item.title || item.item?.title || "Sản phẩm",
        code: item.sku || item.item?.sku || "SKU",
        quantity: qty,
        price: item.unit_price || 0,
        length: item.length || 10,
        width: item.width || 10,
        height: item.height || 10,
        weight: Math.max(item.weight || 200, 50),
        category: item.category || { level1: "General" },
      }
    })

    if (totalWeight <= 0) totalWeight = settings.default_weight

    const serviceTypeId = 2

    const clientOrderCode = (order as any)?.display_id
      ? `ORD-${(order as any).display_id}`
      : `FUL-${fulfillment?.id?.slice(-8) || Date.now()}`

    try {
      const ghnOrder = await client.createShippingOrder({
        to_name: recipientName,
        to_phone: recipientPhone,
        to_address: recipientAddress,
        to_district_id: Number(toDistrictId),
        to_ward_code: String(toWardCode),
        weight: totalWeight,
        length: settings.default_length,
        width: settings.default_width,
        height: settings.default_height,
        service_type_id: serviceTypeId,
        payment_type_id: settings.payment_type_id,
        required_note: settings.required_note,
        client_order_code: clientOrderCode,
        content: `Đơn hàng ${clientOrderCode} - Synapse`,
        items: ghnItems.length > 0 ? ghnItems : [
          {
            name: "Gói hàng",
            quantity: 1,
            weight: totalWeight,
          },
        ],
      })

      let printToken = ""
      try {
        const tokenRes = await client.generatePrintToken([ghnOrder.order_code])
        printToken = tokenRes.token
      } catch {
        // print token can be generated on-demand later
      }

      const trackingUrl =
        settings.environment === "production"
          ? `https://donhang.ghn.vn/?order_code=${ghnOrder.order_code}`
          : ""
      const printUrl = printToken ? client.getPrintUrl(printToken, "A5") : ""

      return {
        data: {
          ...((fulfillment as any)?.data || {}),
          ...data,
          ghn_order_code: ghnOrder.order_code,
          ghn_total_fee: ghnOrder.total_fee,
          ghn_expected_delivery: ghnOrder.expected_delivery_time,
          ghn_print_token: printToken,
          ghn_print_url: printUrl,
          ghn_environment: settings.environment,
          tracking_number: ghnOrder.order_code,
        },
        labels: [
          {
            tracking_number: ghnOrder.order_code,
            tracking_url: trackingUrl,
            label_url: printUrl,
          },
        ],
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Không thể tạo đơn giao hàng GHN: ${msg}`
      )
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    const orderCode =
      (data?.ghn_order_code as string) || (data?.tracking_number as string)
    if (!orderCode) {
      return
    }

    const client = await this.getClient()
    try {
      await client.cancelOrder([orderCode])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Không thể hủy đơn giao hàng GHN: ${msg}`
      )
    }
  }

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    return {
      data: {
        ...(fulfillment || {}),
        status: "return_initiated",
      },
      labels: [],
    }
  }
}

export default GhnFulfillmentProviderService
