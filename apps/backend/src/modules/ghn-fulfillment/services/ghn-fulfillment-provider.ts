import {
  AbstractFulfillmentProviderService,
  ContainerRegistrationKeys,
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
import { buildPackingPlan, type PackedPackage } from "../../shipping-hub/packing-profile"

export type GhnProviderOptions = {
  api_token?: string
  shop_id?: number
  client_id?: number
  base_url?: string
  environment?: "sandbox" | "production"
}

type EnrichedFulfillmentItem = Partial<
  Omit<FulfillmentItemDTO, "fulfillment">
> & {
  height?: number | null
  length?: number | null
  title?: string | null
  unit_price?: number | null
  weight?: number | null
  width?: number | null
}

type OrderLineItemDetails = {
  id: string
  product_title?: string | null
  title?: string | null
  unit_price?: number | null
  variant?: {
    height?: number | null
    length?: number | null
    weight?: number | null
    width?: number | null
  } | null
  variant_title?: string | null
}

function persistedShippingPackages(
  value: unknown
): PackedPackage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return []
    }

    const parcel = candidate as Partial<PackedPackage>
    const height = Number(parcel.height)
    const length = Number(parcel.length)
    const weight = Number(parcel.weight)
    const width = Number(parcel.width)

    if (
      ![height, length, weight, width].every(
        (dimension) => Number.isFinite(dimension) && dimension > 0
      )
    ) {
      return []
    }

    return [{
      box_code:
        typeof parcel.box_code === "string" && parcel.box_code.trim()
          ? parcel.box_code.trim().toUpperCase()
          : "CUSTOM",
      height,
      item_count: Math.max(1, Math.floor(Number(parcel.item_count) || 1)),
      length,
      weight,
      width,
    }]
  })
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
    try {
      return await getGhnSettings(this.container_)
    } catch {
      return GhnSettingsStore.getSettings()
    }
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

    const shippingAddress =
      (context as any)?.shipping_address || (context as any)?.cart?.shipping_address
    const items = (context as any)?.items || (context as any)?.cart?.items || []
    const requestData = data as Record<string, unknown> | undefined
    const requestedWeight = Number(requestData?.ghn_weight)

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
          Number.isFinite(requestedWeight) && requestedWeight > 0
            ? requestedWeight
            : settings.default_weight
        )
    const fallbackPackage: PackedPackage = {
      box_code: "DEFAULT",
      height: settings.default_height,
      item_count: 1,
      length: settings.default_length,
      weight: Number.isFinite(requestedWeight) && requestedWeight > 0
        ? requestedWeight
        : settings.default_weight,
      width: settings.default_width,
    }
    const packagesToQuote = packages.length ? packages : [fallbackPackage]

    const serviceTypeId = 2

    try {
      const feeResponses = await Promise.all(
        packagesToQuote.map((parcel) => client.calculateFee({
          from_district_id: settings.sender_district_id,
          from_ward_code: settings.sender_ward_code,
          to_district_id: Number(toDistrictId),
          to_ward_code: toWardCode ? String(toWardCode) : undefined,
          weight: parcel.weight,
          length: parcel.length,
          width: parcel.width,
          height: parcel.height,
          service_type_id: serviceTypeId,
        }))
      )

      return {
        calculated_amount: feeResponses.reduce((total, response) => total + response.total, 0),
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

    let enrichedItems = items as EnrichedFulfillmentItem[]
    try {
      const query = this.container_?.resolve?.(ContainerRegistrationKeys.QUERY)
      if (query && items.length) {
        const lineItemIds = items
          .map((item) => item.line_item_id || item.id)
          .filter((id): id is string => Boolean(id))
        const { data: lineItems } = await query.graph({
          entity: "order_line_item",
          fields: [
            "id",
            "title",
            "product_title",
            "variant_title",
            "unit_price",
            "variant.weight",
            "variant.width",
            "variant.length",
            "variant.height",
          ],
          filters: { id: lineItemIds },
        })
        const itemsById = new Map(
          (lineItems as OrderLineItemDetails[]).map((lineItem) => [
            lineItem.id,
            lineItem,
          ])
        )
        enrichedItems = (items as EnrichedFulfillmentItem[]).map((item) => {
          const lineItemId = item.line_item_id || item.id
          const li = lineItemId ? itemsById.get(lineItemId) : undefined
          if (!li) return item

          return {
            ...item,
            height: li.variant?.height ?? item.height,
            length: li.variant?.length ?? item.length,
            title: li.title || li.product_title || item.title,
            unit_price: li.unit_price ?? item.unit_price,
            weight: li.variant?.weight ?? item.weight,
            width: li.variant?.width ?? item.width,
          }
        })
      }
    } catch {
      // The core workflow already supplies fulfillment-safe item data. The
      // lookup only enriches optional GHN dimensions and must not block it.
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
    const recipientPhone = shippingAddress.phone
    const recipientAddress =
      [
        shippingAddress.address_1,
        shippingAddress.address_2,
        shippingAddress.city,
        shippingAddress.province,
      ]
        .filter(Boolean)
        .join(", ")

    if (!recipientPhone || !recipientAddress) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "GHN fulfillment requires the recipient phone and delivery address."
      )
    }

    // A GHN quote is tied to its package plan. Repacking after checkout can
    // create a different carrier fee from the one the customer accepted.
    const selectedPackages = persistedShippingPackages(data.shipping_packages)
    const packagePlan = selectedPackages.length
      ? selectedPackages
      : buildPackingPlan(
          (enrichedItems || []).map((item: any) => ({
            height: item.item?.variant?.height || item.height,
            length: item.item?.variant?.length || item.length,
            quantity: item.quantity,
            weight: item.item?.variant?.weight || item.weight,
            width: item.item?.variant?.width || item.width,
          })),
          settings.packing_profile,
          settings.default_weight
        )
    const fallbackParcel = {
      height: settings.default_height,
      length: settings.default_length,
      weight: settings.default_weight,
      width: settings.default_width,
    }
    let totalWeight = 0
    const ghnItems = (enrichedItems || []).map((item: any) => {
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
      const parcels = packagePlan.length ? packagePlan : [fallbackParcel]
      const ghnOrders = [] as Awaited<ReturnType<GhnClient["createShippingOrder"]>>[]
      try {
        for (const [index, parcel] of parcels.entries()) {
          const parcelOrderCode = parcels.length > 1
            ? `${clientOrderCode}-P${index + 1}`
            : clientOrderCode
          const ghnOrder = await client.createShippingOrder({
            to_name: recipientName,
            to_phone: recipientPhone,
            to_address: recipientAddress,
            to_district_id: Number(toDistrictId),
            to_ward_code: String(toWardCode),
            weight: parcel.weight,
            length: parcel.length,
            width: parcel.width,
            height: parcel.height,
            service_type_id: serviceTypeId,
            payment_type_id: settings.payment_type_id,
            required_note: settings.required_note,
            client_order_code: parcelOrderCode,
            content: `Đơn hàng ${clientOrderCode} - kiện ${index + 1}/${parcels.length}`,
            items: index === 0 && ghnItems.length > 0 ? ghnItems : [
              {
                name: `Kiện hàng ${index + 1}`,
                quantity: 1,
                weight: parcel.weight,
              },
            ],
          })
          ghnOrders.push(ghnOrder)
        }
      } catch (error) {
        await client.cancelOrder(ghnOrders.map((order) => order.order_code)).catch(() => undefined)
        throw error
      }

      let printToken = ""
      try {
        const tokenRes = await client.generatePrintToken(
          ghnOrders.map((order) => order.order_code)
        )
        printToken = tokenRes.token
      } catch {
        // print token can be generated on-demand later
      }

      const primaryOrder = ghnOrders[0]
      const trackingUrl = settings.environment === "production"
        ? `https://donhang.ghn.vn/?order_code=${primaryOrder.order_code}`
        : ""
      const printUrl = printToken ? client.getPrintUrl(printToken, "A5") : ""

      return {
        data: {
          ...((fulfillment as any)?.data || {}),
          ...data,
          ghn_order_code: primaryOrder.order_code,
          ghn_order_codes: ghnOrders.map((order) => order.order_code),
          ghn_total_fee: ghnOrders.reduce((total, order) => total + order.total_fee, 0),
          ghn_expected_delivery: primaryOrder.expected_delivery_time,
          ghn_print_token: printToken,
          ghn_print_url: printUrl,
          ghn_environment: settings.environment,
          order_display_id: (order as any)?.display_id,
          order_id: (order as any)?.id,
          shipping_packages: packagePlan,
          tracking_number: primaryOrder.order_code,
        },
        labels: ghnOrders.map((order) => ({
          tracking_number: order.order_code,
          tracking_url: settings.environment === "production"
            ? `https://donhang.ghn.vn/?order_code=${order.order_code}`
            : "",
          label_url: printUrl,
        })),
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
    const orderCodes = Array.isArray(data?.ghn_order_codes)
      ? data.ghn_order_codes.filter((code): code is string => typeof code === "string")
      : [(data?.ghn_order_code as string) || (data?.tracking_number as string)].filter(Boolean)
    if (!orderCodes.length) {
      return
    }

    const client = await this.getClient()
    try {
      await client.cancelOrder(orderCodes)
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
