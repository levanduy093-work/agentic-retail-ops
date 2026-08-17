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
import { GhtkClient } from "../ghtk-client"
import { GhtkSettingsStore } from "./ghtk-settings-store"
import { getGhtkSettings } from "../../shipping-hub/ghtk-connection"
import { buildPackingPlan, type PackedPackage } from "../../shipping-hub/packing-profile"

export type GhtkProviderOptions = {
  api_token?: string
  base_url?: string
  environment?: "sandbox" | "production"
  pick_address_id?: string
  sender_name?: string
  sender_phone?: string
  sender_address?: string
  sender_province?: string
  sender_district?: string
  sender_ward?: string
}

export class GhtkFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "ghtk"

  protected options_: GhtkProviderOptions
  private container_: any

  constructor(_container: unknown, options: GhtkProviderOptions = {}) {
    // @ts-ignore Medusa injects the provider container at runtime.
    super(...arguments)
    this.options_ = options
    this.container_ = _container

    if (!GhtkSettingsStore.getSettings().api_token && options.api_token) {
      GhtkSettingsStore.setRuntimeSettings({
        ...GhtkSettingsStore.getLegacySettings(),
        api_token: options.api_token,
        base_url: options.base_url,
        environment: options.environment || "sandbox",
        pick_address_id: options.pick_address_id,
        sender_address:
          options.sender_address ||
          GhtkSettingsStore.getLegacySettings().sender_address,
        sender_district:
          options.sender_district ||
          GhtkSettingsStore.getLegacySettings().sender_district,
        sender_name:
          options.sender_name ||
          GhtkSettingsStore.getLegacySettings().sender_name,
        sender_phone:
          options.sender_phone ||
          GhtkSettingsStore.getLegacySettings().sender_phone,
        sender_province:
          options.sender_province ||
          GhtkSettingsStore.getLegacySettings().sender_province,
        sender_ward:
          options.sender_ward ||
          GhtkSettingsStore.getLegacySettings().sender_ward,
      })
    }
  }

  private async getSettings() {
    return getGhtkSettings(this.container_)
  }

  private async getClient(): Promise<GhtkClient> {
    const settings = await this.getSettings()
    return new GhtkClient({
      apiToken: settings.api_token,
      baseUrl: settings.base_url,
      environment: settings.environment,
    })
  }

  async getFulfillmentOptions(): Promise<
    Array<{ id: string; name: string; is_return?: boolean }>
  > {
    return [
      {
        id: "ghtk-road",
        name: "Giao Hàng Tiết Kiệm - Chuẩn (Đường bộ)",
      },
      {
        id: "ghtk-fly",
        name: "Giao Hàng Tiết Kiệm - Nhanh (Đường bay)",
      },
      {
        id: "ghtk-road-return",
        name: "Giao Hàng Tiết Kiệm - Trả hàng",
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
    let client: GhtkClient
    try {
      settings = await this.getSettings()
      client = await this.getClient()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GHTK connection could not be loaded: ${message}`
      )
    }

    const shippingAddress =
      (context as any)?.shipping_address ||
      (context as any)?.cart?.shipping_address
    const items =
      (context as any)?.items || (context as any)?.cart?.items || []

    const province =
      shippingAddress?.province ||
      shippingAddress?.metadata?.province ||
      (data?.province as string | undefined)
    const district =
      shippingAddress?.city ||
      shippingAddress?.metadata?.district ||
      (data?.district as string | undefined)
    const ward =
      shippingAddress?.address_2 ||
      shippingAddress?.metadata?.ward ||
      (data?.ward as string | undefined)
    const address = shippingAddress?.address_1 || (data?.address as string | undefined)

    if (!province || !district) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "GHTK requires a delivery province and district. Complete the Vietnam shipping address before choosing a shipping method."
      )
    }

    const requestData = data as Record<string, unknown> | undefined
    const requestedPackages = Array.isArray(requestData?.shipping_packages)
      ? requestData.shipping_packages as PackedPackage[]
      : []
    const packages = requestedPackages.length
      ? requestedPackages
      : buildPackingPlan(
          Array.isArray(items) ? items.map((item: any) => ({
            height: item.variant?.height || item.height,
            length: item.variant?.length || item.length,
            quantity: item.quantity,
            weight: item.variant?.weight || item.weight,
            width: item.variant?.width || item.width,
          })) : [],
          settings.packing_profile,
          settings.default_weight
        )
    const totalWeight = packages.length
      ? packages.reduce((total, parcel) => total + parcel.weight, 0)
      : settings.default_weight

    const transport =
      optionData?.id === "ghtk-fly" || data?.transport === "fly"
        ? "fly"
        : "road"

    try {
      const feeResponse = await client.calculateFee({
        address,
        district,
        pick_address: settings.sender_address,
        pick_district: settings.sender_district,
        pick_province: settings.sender_province,
        pick_ward: settings.sender_ward,
        province,
        transport,
        ward,
        weight: totalWeight,
      })

      return {
        calculated_amount: feeResponse.fee,
        is_calculated_price_tax_inclusive: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GHTK could not calculate the shipping fee: ${message}`
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

    const shippingAddress =
      (order as any)?.shipping_address ||
      (fulfillment as any)?.shipping_address
    if (!shippingAddress) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot create GHTK fulfillment without shipping address"
      )
    }

    const province =
      shippingAddress.province ||
      shippingAddress.metadata?.province ||
      (data?.province as string | undefined)
    const district =
      shippingAddress.city ||
      shippingAddress.metadata?.district ||
      (data?.district as string | undefined)
    const ward =
      shippingAddress.address_2 ||
      shippingAddress.metadata?.ward ||
      (data?.ward as string | undefined)

    if (!province || !district) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "GHTK fulfillment requires the destination province and district selected at checkout."
      )
    }

    const recipientName =
      [shippingAddress.first_name, shippingAddress.last_name]
        .filter(Boolean)
        .join(" ") || "Khách hàng"
    const recipientPhone = shippingAddress.phone || "0900000000"
    const recipientAddress =
      shippingAddress.address_1 ||
      [shippingAddress.address_2, district, province]
        .filter(Boolean)
        .join(", ")

    const packagePlan = buildPackingPlan(
      (items || []).map((item: any) => ({
        height: item.item?.variant?.height || item.height,
        length: item.item?.variant?.length || item.length,
        quantity: item.quantity,
        weight: item.item?.variant?.weight || item.weight,
        width: item.item?.variant?.width || item.width,
      })),
      settings.packing_profile,
      settings.default_weight
    )
    let totalWeight = 0
    let totalValue = 0
    const ghtkProducts = (items || []).map((item: any) => {
      const w =
        item.item?.variant?.weight || item.weight || settings.default_weight
      const qty = item.quantity || 1
      const price = Number(item.unit_price || item.item?.unit_price || 0)
      totalWeight += w * qty
      totalValue += price * qty
      return {
        name:
          item.title ||
          item.item?.title ||
          item.item?.product_title ||
          "Sản phẩm",
        price,
        product_code:
          item.item?.variant_sku || item.item?.variant_id || item.item_id,
        quantity: qty,
        weight: Number((w / 1000).toFixed(3)), // GHTK items weight in kg
      }
    })

    totalWeight = packagePlan.length
      ? packagePlan.reduce((total, parcel) => total + parcel.weight, 0)
      : totalWeight || settings.default_weight

    const orderDisplayId = (order as any)?.display_id
    const orderId =
      (order as any)?.id ||
      (fulfillment as any)?.order_id ||
      `ful_${Date.now()}`
    const partnerId = orderDisplayId ? `ORD-${orderDisplayId}` : orderId

    const transport =
      data?.id === "ghtk-fly" || data?.transport === "fly" ? "fly" : "road"

    try {
      const ghtkOrder = await client.createOrder({
        products: ghtkProducts,
        order: {
          address: recipientAddress,
          district,
          email: (order as any)?.email,
          id: partnerId,
          is_freeship: settings.is_freeship ? 1 : 0,
          name: recipientName,
          pick_address: settings.sender_address,
          pick_address_id: settings.pick_address_id,
          pick_district: settings.sender_district,
          pick_name: settings.sender_name,
          pick_province: settings.sender_province,
          pick_tel: settings.sender_phone,
          pick_ward: settings.sender_ward,
          province,
          tel: recipientPhone,
          total_weight: Number((totalWeight / 1000).toFixed(3)),
          transport,
          value: totalValue > 0 ? totalValue : undefined,
          ward,
        },
      })

      const printUrl = client.getPrintUrl(ghtkOrder.label)
      const trackingUrl = `https://i.ghtk.vn/${ghtkOrder.label}`

      return {
        data: {
          ...data,
          carrier_code: "GHTK",
          carrier_name: "Giao Hàng Tiết Kiệm",
          ghtk_area: ghtkOrder.area,
          ghtk_current_status: "Đã tiếp nhận",
          ghtk_estimated_deliver_time: ghtkOrder.estimated_deliver_time,
          ghtk_estimated_pick_time: ghtkOrder.estimated_pick_time,
          ghtk_fee: ghtkOrder.fee,
          ghtk_insurance_fee: ghtkOrder.insurance_fee,
          ghtk_label_id: ghtkOrder.label,
          ghtk_order_code: ghtkOrder.label,
          ghtk_partner_id: ghtkOrder.partner_id,
          ghtk_print_url: printUrl,
          ghtk_status_id: ghtkOrder.status_id,
          ghtk_tracking_id: ghtkOrder.tracking_id,
          ghtk_tracking_url: trackingUrl,
          label_url: printUrl,
          partner_id: ghtkOrder.partner_id,
          tracking_number: ghtkOrder.label,
          tracking_url: trackingUrl,
          shipping_packages: packagePlan,
        },
        labels: [
          {
            label_url: printUrl,
            tracking_number: ghtkOrder.label,
            tracking_url: trackingUrl,
          },
        ],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GHTK could not create fulfillment: ${message}`
      )
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    const trackingNumber =
      (data.ghtk_label_id as string | undefined) ||
      (data.ghtk_order_code as string | undefined) ||
      (data.tracking_number as string | undefined) ||
      (data.partner_id as string | undefined)

    if (!trackingNumber) {
      return { canceled: true }
    }

    try {
      const client = await this.getClient()
      await client.cancelOrder(trackingNumber)
      return {
        canceled: true,
        ghtk_current_status: "Hủy đơn hàng",
        ghtk_status_id: -1,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GHTK could not cancel fulfillment: ${message}`
      )
    }
  }

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    return {
      data: {
        ...(fulfillment || {}),
        carrier_code: "GHTK",
        carrier_name: "Giao Hàng Tiết Kiệm",
        ghtk_current_status: "Đã tiếp nhận yêu cầu trả hàng",
        status: "return_initiated",
      },
      labels: [],
    }
  }
}

export default GhtkFulfillmentProviderService
