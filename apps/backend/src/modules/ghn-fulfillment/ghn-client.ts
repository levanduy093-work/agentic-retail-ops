import { MedusaError } from "@medusajs/framework/utils"

export type GhnEnvironment = "sandbox" | "production"


export type GhnConfig = {
  apiToken: string
  shopId: number
  clientId?: number
  environment: GhnEnvironment
  baseUrl?: string
}

export type GhnProvince = {
  ProvinceID: number
  ProvinceName: string
  Code: string
  NameExtension: string[]
}

export type GhnDistrict = {
  DistrictID: number
  ProvinceID: number
  DistrictName: string
  Code: string
  Type: number
  SupportType: number
  NameExtension: string[]
}

export type GhnWard = {
  WardCode: string
  DistrictID: number
  WardName: string
  NameExtension: string[]
  SupportType: number
}

export type GhnService = {
  service_id: number
  short_name: string
  service_type_id: number
}

export type GhnCalculateFeeInput = {
  from_district_id?: number
  from_ward_code?: string
  to_district_id: number
  to_ward_code?: string
  height?: number
  length?: number
  weight: number
  width?: number
  insurance_value?: number
  service_id?: number
  service_type_id?: number
  coupon?: string | null
}

export type GhnFeeResponse = {
  total: number
  service_fee: number
  insurance_fee: number
  pick_station_fee: number
  coupon_value: number
  r2s_fee: number
  document_return: number
  double_check: number
}

export type GhnOrderItem = {
  name: string
  code?: string
  quantity: number
  price?: number
  length?: number
  width?: number
  height?: number
  weight: number
  category?: {
    level1?: string
  }
}

export type GhnCreateOrderInput = {
  payment_type_id?: number // 1: Shop/Seller pays, 2: Buyer/Receiver pays
  note?: string
  required_note?: "CHOTOT" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG"
  from_name?: string
  from_phone?: string
  from_address?: string
  from_ward_name?: string
  from_district_name?: string
  from_province_name?: string
  return_phone?: string
  return_address?: string
  return_district_id?: number
  return_ward_code?: string
  client_order_code?: string
  to_name: string
  to_phone: string
  to_address: string
  to_ward_code: string
  to_district_id: number
  cod_amount?: number
  content?: string
  weight: number
  length?: number
  width?: number
  height?: number
  pick_station_id?: number
  insurance_value?: number
  service_id?: number
  service_type_id?: number
  coupon?: string | null
  items: GhnOrderItem[]
}

export type GhnCreateOrderResponse = {
  order_code: string
  sort_code: string
  trans_type: string
  ward_encode: string
  district_encode: string
  fee: {
    name?: string
    fee?: number
    insurance_fee?: number
    main_service?: number
    r2s_fee?: number
    return_again?: number
    station_do?: number
    station_pu?: number
  }
  total_fee: number
  expected_delivery_time: string
}

export type GhnOrderDetailResponse = {
  order_code: string
  status: string
  status_name?: string
  leadtime?: string
  order_date?: string
  to_name: string
  to_phone: string
  to_address: string
  to_ward_code: string
  to_district_id: number
  cod_amount: number
  total_fee: number
  log?: Array<{
    status: string
    payment_type_id: number
    updated_date: string
  }>
}

export const GHN_SANDBOX_BASE_URL =
  "https://dev-online-gateway.ghn.vn/shiip/public-api"
export const GHN_PRODUCTION_BASE_URL =
  "https://online-gateway.ghn.vn/shiip/public-api"

export class GhnClient {
  private config: GhnConfig

  constructor(config: GhnConfig) {
    this.config = {
      ...config,
      baseUrl:
        config.baseUrl ||
        (config.environment === "production"
          ? GHN_PRODUCTION_BASE_URL
          : GHN_SANDBOX_BASE_URL),
    }
  }

  public updateConfig(config: Partial<GhnConfig>) {
    this.config = {
      ...this.config,
      ...config,
      baseUrl:
        config.baseUrl ||
        (config.environment === "production"
          ? GHN_PRODUCTION_BASE_URL
          : GHN_SANDBOX_BASE_URL) ||
        this.config.baseUrl,
    }
  }

  public getConfig(): GhnConfig {
    return { ...this.config }
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST"
      body?: unknown
      params?: Record<string, string | number>
    } = {}
  ): Promise<T> {
    const { method = "GET", body, params } = options
    let url = `${this.config.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      }
      const queryStr = searchParams.toString()
      if (queryStr) {
        url += (url.includes("?") ? "&" : "?") + queryStr
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Token: this.config.apiToken,
    }

    if (this.config.shopId) {
      headers["ShopId"] = String(this.config.shopId)
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const json = await response.json().catch(() => null)

      if (!response.ok || (json && json.code && json.code >= 400)) {
        const errorMsg =
          json?.message ||
          json?.code_message_value ||
          `GHN API error: ${response.status} ${response.statusText}`
        throw new MedusaError(MedusaError.Types.INVALID_DATA, errorMsg)
      }

      return (json?.data !== undefined ? json.data : json) as T
    } catch (err: unknown) {
      if (err instanceof MedusaError) {
        throw err
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `[GHN Client] ${message}`
      )
    }
  }

  // --- Master Data APIs ---

  async getProvinces(): Promise<GhnProvince[]> {
    return this.request<GhnProvince[]>("/master-data/province", {
      method: "GET",
    })
  }

  async getDistricts(provinceId?: number): Promise<GhnDistrict[]> {
    return this.request<GhnDistrict[]>("/master-data/district", {
      method: "POST",
      body: provinceId ? { province_id: provinceId } : {},
    })
  }

  async getWards(districtId: number): Promise<GhnWard[]> {
    return this.request<GhnWard[]>("/master-data/ward", {
      method: "POST",
      body: { district_id: districtId },
    })
  }

  // --- Available Services ---

  async getAvailableServices(
    fromDistrict: number,
    toDistrict: number
  ): Promise<GhnService[]> {
    return this.request<GhnService[]>("/v2/shipping-order/available-services", {
      method: "POST",
      body: {
        shop_id: this.config.shopId,
        from_district: fromDistrict,
        to_district: toDistrict,
      },
    })
  }

  // --- Fee Calculation ---

  async calculateFee(input: GhnCalculateFeeInput): Promise<GhnFeeResponse> {
    const payload = {
      from_district_id: input.from_district_id,
      from_ward_code: input.from_ward_code,
      service_id: input.service_id,
      service_type_id: input.service_type_id || 2, // 2: Standard delivery (E-commerce)
      to_district_id: input.to_district_id,
      to_ward_code: input.to_ward_code,
      height: input.height || 10,
      length: input.length || 15,
      weight: Math.max(input.weight || 200, 50),
      width: input.width || 10,
      insurance_value: input.insurance_value || 0,
      coupon: input.coupon || null,
    }

    return this.request<GhnFeeResponse>("/v2/shipping-order/fee", {
      method: "POST",
      body: payload,
    })
  }

  // --- Create Shipping Order ---

  async createShippingOrder(
    input: GhnCreateOrderInput
  ): Promise<GhnCreateOrderResponse> {
    const payload: Record<string, unknown> = {
      payment_type_id: input.payment_type_id ?? 1, // 1: Seller pays shipping fee
      note: input.note || "",
      required_note: input.required_note || "KHONGCHOXEMHANG",
      return_phone: input.return_phone,
      return_address: input.return_address,
      return_district_id: input.return_district_id,
      return_ward_code: input.return_ward_code,
      client_order_code: input.client_order_code,
      to_name: input.to_name,
      to_phone: input.to_phone,
      to_address: input.to_address,
      to_ward_code: input.to_ward_code,
      to_district_id: input.to_district_id,
      cod_amount: input.cod_amount || 0,
      content: input.content || "Đơn hàng từ Synapse DTC",
      weight: Math.max(input.weight || 200, 50),
      length: input.length || 15,
      width: input.width || 10,
      height: input.height || 10,
      pick_station_id: input.pick_station_id,
      insurance_value: input.insurance_value || 0,
      service_id: input.service_id,
      service_type_id: input.service_type_id || 2,
      coupon: input.coupon || null,
      items: input.items.map((item) => ({
        name: item.name,
        code: item.code || item.name,
        quantity: item.quantity,
        price: item.price || 0,
        length: item.length || 10,
        width: item.width || 10,
        height: item.height || 10,
        weight: Math.max(item.weight || 200, 50),
        category: item.category || { level1: "General" },
      })),
    }

    if (input.from_name) payload.from_name = input.from_name
    if (input.from_phone) payload.from_phone = input.from_phone
    if (input.from_address) payload.from_address = input.from_address
    if (input.from_ward_name) payload.from_ward_name = input.from_ward_name
    if (input.from_district_name)
      payload.from_district_name = input.from_district_name
    if (input.from_province_name)
      payload.from_province_name = input.from_province_name

    return this.request<GhnCreateOrderResponse>("/v2/shipping-order/create", {
      method: "POST",
      body: payload,
    })
  }

  // --- Cancel Order ---

  async cancelOrder(orderCodes: string[]): Promise<unknown> {
    return this.request("/v2/switch-status/cancel", {
      method: "POST",
      body: { order_codes: orderCodes },
    })
  }

  // --- Order Details & Tracking ---

  async getOrderDetail(orderCode: string): Promise<GhnOrderDetailResponse> {
    return this.request<GhnOrderDetailResponse>("/v2/shipping-order/detail", {
      method: "POST",
      body: { order_code: orderCode },
    })
  }

  // --- Print Label Token ---

  async generatePrintToken(orderCodes: string[]): Promise<{ token: string }> {
    return this.request<{ token: string }>("/v2/a5/gen-token", {
      method: "POST",
      body: { order_codes: orderCodes },
    })
  }

  getPrintUrl(
    token: string,
    size: "A5" | "80x80" | "52x70" = "A5"
  ): string {
    const isProd = this.config.environment === "production"
    const host = isProd
      ? "https://online-gateway.ghn.vn"
      : "https://dev-online-gateway.ghn.vn"

    switch (size) {
      case "80x80":
        return `${host}/a5/public-api/print80x80?token=${token}`
      case "52x70":
        return `${host}/a5/public-api/print52x70?token=${token}`
      case "A5":
      default:
        return `${host}/a5/public-api/printA5?token=${token}`
    }
  }

  // --- Test Connection ---

  async testConnection(): Promise<{
    success: boolean
    message: string
    environment: "sandbox" | "production"
    base_url: string
    shop_id?: number
    provinces_count?: number
    latency_ms?: number
    verified_at: string
  }> {
    const startTime = Date.now()
    const baseUrl = this.config.baseUrl || ""
    try {
      const provinces = await this.getProvinces()
      const latencyMs = Date.now() - startTime
      if (Array.isArray(provinces) && provinces.length > 0) {
        return {
          success: true,
          message: `Kết nối thành công đến hệ thống GHN (${this.config.environment})! Đã đồng bộ ${provinces.length} tỉnh thành (${latencyMs}ms).`,
          environment: this.config.environment,
          base_url: baseUrl,
          shop_id: this.config.shopId,
          provinces_count: provinces.length,
          latency_ms: latencyMs,
          verified_at: new Date().toISOString(),
        }
      }
      return {
        success: false,
        message: "Không nhận được dữ liệu hợp lệ từ GHN.",
        environment: this.config.environment,
        base_url: baseUrl,
        shop_id: this.config.shopId,
        latency_ms: Date.now() - startTime,
        verified_at: new Date().toISOString(),
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        message: `Kết nối thất bại: ${msg}`,
        environment: this.config.environment,
        base_url: baseUrl,
        shop_id: this.config.shopId,
        latency_ms: Date.now() - startTime,
        verified_at: new Date().toISOString(),
      }
    }
  }
}
