import { MedusaError } from "@medusajs/framework/utils"

export type GhtkEnvironment = "sandbox" | "production"

export type GhtkConfig = {
  apiToken: string
  environment: GhtkEnvironment
  baseUrl?: string
}

export type GhtkPickAddress = {
  pick_address_id: string
  address: string
  pick_tel: string
  pick_name: string
}

export type GhtkCalculateFeeInput = {
  pick_province?: string
  pick_district?: string
  pick_ward?: string
  pick_address?: string
  province: string
  district: string
  ward?: string
  address?: string
  weight: number // in grams
  value?: number // order value in VND
  transport?: "road" | "fly"
  deliver_option?: "none" | "xteam"
  tags?: number[]
}

export type GhtkFeeResponse = {
  name: string
  fee: number
  insurance_fee: number
  include_vat?: string | number
  cost_id?: string
  delivery_type?: string
  delivery?: boolean
  dt?: string
}

export type GhtkProductItem = {
  name: string
  weight: number // in kg
  quantity: number
  product_code?: string
  price?: number
}

export type GhtkCreateOrderInput = {
  products: GhtkProductItem[]
  order: {
    id: string
    pick_name?: string
    pick_money?: number
    pick_address_id?: string
    pick_address?: string
    pick_province?: string
    pick_district?: string
    pick_ward?: string
    pick_tel?: string
    name: string
    address: string
    province: string
    district: string
    ward?: string
    hamlet?: string
    tel: string
    note?: string
    email?: string
    is_freeship?: number // 1: Shop pays shipping fee, 0: Customer pays
    transport?: "road" | "fly"
    value?: number
    opm?: number
    pick_option?: "cod" | "post"
    deliver_option?: "none" | "xteam"
    total_weight?: number
  }
}

export type GhtkCreateOrderResponse = {
  partner_id: string
  label: string
  area?: string
  fee?: number | string
  insurance_fee?: number | string
  estimated_pick_time?: string
  estimated_deliver_time?: string
  status_id?: number
  tracking_id?: number
}

export type GhtkOrderDetailResponse = {
  label_id: string
  partner_id: string
  status: string
  status_text: string
  created: string
  modified: string
  message?: string
  pick_date?: string
  deliver_date?: string
  customer_fullname?: string
  customer_tel?: string
  address?: string
  storage_day?: number
  ship_money?: number
  insurance?: number
  value?: number
  weight?: number
}

export type GhtkConnectionTestResult = {
  success: boolean
  message: string
  pick_addresses_count?: number
  latency_ms?: number
  pick_addresses?: GhtkPickAddress[]
}

const SANDBOX_BASE_URL = "https://dev.ghtk.vn"
const PRODUCTION_BASE_URL = "https://services.giaohangtietkiem.vn"

export class GhtkClient {
  private config: GhtkConfig
  private baseUrl: string

  constructor(config: GhtkConfig) {
    this.config = config
    this.baseUrl =
      config.baseUrl ||
      (config.environment === "production"
        ? PRODUCTION_BASE_URL
        : SANDBOX_BASE_URL)
  }

  public getConfig(): GhtkConfig & { baseUrl: string } {
    return {
      ...this.config,
      baseUrl: this.baseUrl,
    }
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST"
      body?: unknown
      params?: Record<string, string | number | undefined | null>
    } = {}
  ): Promise<T> {
    const { method = "GET", body, params } = options
    let url = `${this.baseUrl}${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value))
        }
      }
      const queryString = searchParams.toString()
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString
      }
    }

    const headers: Record<string, string> = {
      Token: this.config.apiToken,
      "X-Client-Source": "Medusa-Synapse",
    }

    if (body) {
      headers["Content-Type"] = "application/json"
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const rawText = await response.text()
    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      if (!response.ok) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `GHTK HTTP Error ${response.status}: ${rawText.slice(0, 200)}`
        )
      }
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GHTK returned invalid JSON: ${rawText.slice(0, 200)}`
      )
    }

    if (!response.ok || data.success === false) {
      const errorMessage =
        data.message || data.error || `GHTK Error: ${response.status}`
      throw new MedusaError(MedusaError.Types.INVALID_DATA, errorMessage)
    }

    return data as T
  }

  public async testConnection(): Promise<GhtkConnectionTestResult> {
    const startTime = Date.now()
    try {
      const response = await this.request<{
        success: boolean
        message?: string
        data?: GhtkPickAddress[]
      }>("/services/shipment/list_pick_add")

      const latency = Date.now() - startTime
      const pickAddresses = response.data || []

      return {
        success: true,
        message: `Kết nối GHTK thành công (${latency}ms). Tìm thấy ${pickAddresses.length} kho lấy hàng.`,
        pick_addresses_count: pickAddresses.length,
        latency_ms: latency,
        pick_addresses: pickAddresses,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      const message =
        error instanceof Error ? error.message : "Không thể kết nối đến GHTK API"
      return {
        success: false,
        message: `Kiểm tra kết nối thất bại: ${message}`,
        latency_ms: latency,
      }
    }
  }

  public async listPickAddresses(): Promise<GhtkPickAddress[]> {
    const response = await this.request<{
      success: boolean
      data?: GhtkPickAddress[]
    }>("/services/shipment/list_pick_add")
    return response.data || []
  }

  public async calculateFee(
    input: GhtkCalculateFeeInput
  ): Promise<GhtkFeeResponse> {
    const response = await this.request<{
      success: boolean
      message?: string
      fee: GhtkFeeResponse
    }>("/services/shipment/fee", {
      method: "GET",
      params: {
        pick_province: input.pick_province,
        pick_district: input.pick_district,
        pick_ward: input.pick_ward,
        pick_address: input.pick_address,
        province: input.province,
        district: input.district,
        ward: input.ward,
        address: input.address,
        weight: input.weight,
        value: input.value,
        transport: input.transport || "road",
        deliver_option: input.deliver_option || "none",
      },
    })

    return response.fee
  }

  public async createOrder(
    input: GhtkCreateOrderInput
  ): Promise<GhtkCreateOrderResponse> {
    const response = await this.request<{
      success: boolean
      message?: string
      order: GhtkCreateOrderResponse
    }>("/services/shipment/order", {
      method: "POST",
      body: input,
    })

    return response.order
  }

  public async cancelOrder(
    labelOrPartnerId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.request<{
      success: boolean
      message: string
    }>(`/services/shipment/cancel/${encodeURIComponent(labelOrPartnerId)}`, {
      method: "POST",
    })

    return response
  }

  public async getOrderStatus(
    labelId: string
  ): Promise<GhtkOrderDetailResponse> {
    const response = await this.request<{
      success: boolean
      message?: string
      order: GhtkOrderDetailResponse
    }>(`/services/shipment/v2/${encodeURIComponent(labelId)}`)

    return response.order
  }

  public getPrintUrl(labelId: string): string {
    return `${this.baseUrl}/services/label/${encodeURIComponent(labelId)}`
  }
}
