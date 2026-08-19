import { MedusaError } from "@medusajs/framework/utils"

export type SepayConfig = {
  apiKey: string
  accountNumber?: string
  bankCode?: string
  accountHolderName?: string
  environment?: "sandbox" | "production"
  baseUrl?: string
}

export type SepayWebhookPayload = {
  id?: number | string
  gateway?: string
  transactionDate?: string
  transaction_date?: string
  accountNumber?: string
  account_number?: string
  code?: string | null
  content?: string
  transaction_content?: string
  transferType?: "in" | "out"
  transfer_type?: "in" | "out"
  transferAmount?: number
  amount_in?: number
  amount_out?: number
  accumulated?: number
  subAccount?: string | null
  referenceCode?: string
  reference_number?: string
  description?: string
}

export const VIETNAM_BANKS: Record<string, { name: string; bin: string; shortName: string }> = {
  MB: { name: "MBBank (Quân Đội)", bin: "970422", shortName: "MBBank" },
  VCB: { name: "Vietcombank (Ngoại Thương)", bin: "970436", shortName: "Vietcombank" },
  TCB: { name: "Techcombank (Kỹ Thương)", bin: "970407", shortName: "Techcombank" },
  ACB: { name: "ACB (Á Châu)", bin: "970416", shortName: "ACB" },
  VPB: { name: "VPBank (Việt Nam Thịnh Vượng)", bin: "970432", shortName: "VPBank" },
  TPB: { name: "TPBank (Tiên Phong)", bin: "970423", shortName: "TPBank" },
  CTG: { name: "VietinBank (Công Thương)", bin: "970415", shortName: "VietinBank" },
  BIDV: { name: "BIDV (Đầu tư và Phát triển VN)", bin: "970418", shortName: "BIDV" },
  STB: { name: "Sacombank (Sài Gòn Thương Tín)", bin: "970403", shortName: "Sacombank" },
  VIB: { name: "VIB (Quốc Tế)", bin: "970441", shortName: "VIB" },
  HDB: { name: "HDBank (Phát Triển TP.HCM)", bin: "970437", shortName: "HDBank" },
  OCB: { name: "OCB (Phương Đông)", bin: "970448", shortName: "OCB" },
  TIMO: { name: "Timo (BVBank)", bin: "970454", shortName: "Timo" },
  MSB: { name: "MSB (Hàng Hải)", bin: "970426", shortName: "MSB" },
  SHB: { name: "SHB (Sài Gòn - Hà Nội)", bin: "970443", shortName: "SHB" },
  SEAB: { name: "SeABank (Đông Nam Á)", bin: "970440", shortName: "SeABank" },
  NAB: { name: "NamABank (Nam Á)", bin: "970428", shortName: "NamABank" },
  KLB: { name: "Kienlongbank (Kiên Long)", bin: "970452", shortName: "Kienlongbank" },
  LPB: { name: "LPBank (Lộc Phát VN)", bin: "970449", shortName: "LPBank" },
}

export class SepayClient {
  private readonly apiKey: string
  private readonly accountNumber: string
  private readonly bankCode: string
  private readonly accountHolderName: string
  private readonly environment: "sandbox" | "production"
  private readonly baseUrl: string

  constructor(config: SepayConfig) {
    this.apiKey = (config.apiKey || "").trim()
    this.accountNumber = (config.accountNumber || "").trim()
    this.bankCode = (config.bankCode || "MB").trim().toUpperCase()
    this.accountHolderName = (config.accountHolderName || "").trim()
    this.environment = config.environment || "production"
    
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/+$/, "")
    } else {
      this.baseUrl =
        this.environment === "sandbox"
          ? "https://userapi-sandbox.sepay.vn/v2"
          : "https://userapi.sepay.vn/v2"
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  public getBinForBank(bankCode: string): string {
    const code = bankCode.toUpperCase()
    return VIETNAM_BANKS[code]?.bin || "970422"
  }

  /**
   * Generates VietQR image URL for SePay / VietQR standard
   */
  public generateVietQrUrl(params: {
    amount: number
    description: string
    bankCode?: string
    accountNumber?: string
    accountHolderName?: string
  }): string {
    const bank = (params.bankCode || this.bankCode || "MB").toUpperCase()
    const accNumber = params.accountNumber || this.accountNumber
    const bin = this.getBinForBank(bank)
    const encodedDesc = encodeURIComponent(params.description)
    const holder = params.accountHolderName || this.accountHolderName
    const encodedName = holder ? `&accountName=${encodeURIComponent(holder)}` : ""

    if (bin && accNumber) {
      return `https://img.vietqr.io/image/${bin}-${accNumber}-compact2.png?amount=${params.amount}&addInfo=${encodedDesc}${encodedName}`
    }

    return `https://qr.sepay.vn/img?acc=${accNumber}&bank=${bank}&amount=${params.amount}&des=${encodedDesc}`
  }

  /**
   * Verify API Key with SePay server across both Sandbox and Production endpoints
   */
  public async verifyCredentials(): Promise<{
    success: boolean
    message: string
    latencyMs: number
    environment?: "sandbox" | "production"
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        message: "API Token không được để trống.",
        latencyMs: 0,
      }
    }

    const startTime = Date.now()

    // Test Sandbox endpoint first, then Production endpoint (or vice versa)
    const endpointsToTry = [
      { url: "https://userapi-sandbox.sepay.vn/v2/transactions?limit=1", env: "sandbox" as const, label: "Test Mode (Sandbox)" },
      { url: "https://userapi.sepay.vn/v2/transactions?limit=1", env: "production" as const, label: "Live Mode" },
      { url: "https://my.sepay.vn/userapi/transactions/list?limit=1", env: "production" as const, label: "UserAPI" },
    ]

    const authHeaders = [
      `Bearer ${this.apiKey}`,
      `Apikey ${this.apiKey}`,
    ]

    for (const endpoint of endpointsToTry) {
      for (const authHeader of authHeaders) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 4000)

          const response = await fetch(endpoint.url, {
            method: "GET",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            const latencyMs = Date.now() - startTime
            return {
              success: true,
              message: `Kết nối thành công với SePay ${endpoint.label} (${latencyMs}ms)`,
              latencyMs,
              environment: endpoint.env,
            }
          }
        } catch {
          // Try next endpoint/auth format
        }
      }
    }

    const latencyMs = Date.now() - startTime
    return {
      success: false,
      message: "API Token không hợp lệ hoặc không thể kết nối tới SePay. Vui lòng kiểm tra lại mã API Key từ mục API Access trên my.sepay.vn.",
      latencyMs,
    }
  }

  /**
   * Validates if webhook payload matches expected API Token or format
   */
  public verifyWebhookAuthorization(authHeader?: string | null): boolean {
    if (!this.apiKey) return true
    if (!authHeader) return false

    const cleanAuth = authHeader.replace(/^(Bearer|Apikey)\s+/i, "").trim()
    return cleanAuth === this.apiKey
  }

  /**
   * Extracts order code from transfer content
   * Example: "DH123456 chuyen tien don hang" -> "DH123456" or numeric 123456
   */
  public extractOrderCodeFromContent(content: string, prefix = "DH"): {
    fullCode: string | null
    orderCode: string | null
  } {
    if (!content) return { fullCode: null, orderCode: null }

    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "")
    // Match prefix followed by digits (e.g. DH123456)
    const regex = new RegExp(`${cleanPrefix}(\\d+)`, "i")
    const match = content.match(regex)

    if (match) {
      return {
        fullCode: match[0],
        orderCode: match[1],
      }
    }

    // Fallback: match any standalone 6-12 digit sequence
    const fallbackMatch = content.match(/\b\d{6,12}\b/)
    if (fallbackMatch) {
      return {
        fullCode: fallbackMatch[0],
        orderCode: fallbackMatch[0],
      }
    }

    return { fullCode: null, orderCode: null }
  }

  /**
   * Fetches recent transactions from SePay API
   */
  public async getRecentTransactions(limit = 20): Promise<SepayWebhookPayload[]> {
    if (!this.apiKey) return []

    const endpoints = [
      `${this.baseUrl}/transactions?limit=${limit}`,
      `https://userapi-sandbox.sepay.vn/v2/transactions?limit=${limit}`,
      `https://userapi.sepay.vn/v2/transactions?limit=${limit}`,
    ]

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })

        if (response.ok) {
          const json = (await response.json()) as any
          const list = json?.data || json?.transactions || json?.messages || []
          if (Array.isArray(list) && list.length >= 0) {
            return list
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    return []
  }
}
