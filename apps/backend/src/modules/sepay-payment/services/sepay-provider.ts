import {
  AbstractPaymentProvider,
  MedusaError,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { SepayClient, type SepayWebhookPayload } from "../sepay-client"
import { getSepaySettings, type SepayFullSettings } from "../../payment-hub/sepay-connection"

export type SepayProviderOptions = {
  api_key?: string
  account_number?: string
  bank_code?: string
  account_holder_name?: string
  base_url?: string
}

export class SepayPaymentProviderService extends AbstractPaymentProvider<SepayProviderOptions> {
  static identifier = "sepay"

  protected options_: SepayProviderOptions
  protected container_: Record<string, unknown>

  constructor(container: Record<string, unknown>, options: SepayProviderOptions = {}) {
    super(container, options)
    this.container_ = container
    this.options_ = options
  }

  private async getClient(): Promise<{ client: SepayClient; settings: SepayFullSettings }> {
    const settings = await getSepaySettings(this.container_)
    const client = new SepayClient({
      apiKey: this.options_.api_key || settings.api_key,
      accountNumber: this.options_.account_number || settings.account_number,
      bankCode: this.options_.bank_code || settings.bank_code,
      accountHolderName: this.options_.account_holder_name || settings.account_holder_name,
      baseUrl: this.options_.base_url,
    })
    return { client, settings }
  }

  /**
   * Generates a unique numeric orderCode for reference
   */
  private generateOrderCode(): number {
    const now = Date.now()
    const slice = String(now).slice(-6)
    const random = Math.floor(100 + Math.random() * 900)
    return Number(`${slice}${random}`)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { client, settings } = await this.getClient()

    if (!client.isConfigured()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cấu hình SePay chưa được thiết lập. Vui lòng cấu hình API Token trong Admin Dashboard."
      )
    }

    const orderCode = this.generateOrderCode()
    const amount = Math.round(Number(input.amount))
    const prefix = (settings.order_prefix || "DH").replace(/[^a-zA-Z0-9]/g, "")
    const description = `${prefix}${orderCode}`.slice(0, 25)

    let expiredAt: number | undefined
    if (settings.is_timeout_enabled && settings.timeout_minutes > 0) {
      expiredAt = Math.floor(Date.now() / 1000) + settings.timeout_minutes * 60
    }

    const bin = client.getBinForBank(settings.bank_code)
    const qrCode = client.generateVietQrUrl({
      amount,
      description,
      bankCode: settings.bank_code,
      accountNumber: settings.account_number,
      accountHolderName: settings.account_holder_name,
    })

    return {
      id: String(orderCode),
      data: {
        orderCode,
        amount,
        description,
        bin,
        accountNumber: settings.account_number,
        accountName: settings.account_holder_name,
        bankCode: settings.bank_code,
        qrCode,
        expiredAt,
        status: "PENDING",
        provider: "sepay",
      },
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const status = await this.getPaymentStatus(input)
    if (status.status === "captured" || status.status === "authorized") {
      return status
    }

    return {
      status: "authorized",
      data: {
        ...(input.data || {}),
        authorized_at: new Date().toISOString(),
      },
    }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = (input.data || {}) as Record<string, unknown>
    const currentStatus = String(data.status || "PENDING").toUpperCase()

    if (currentStatus === "PAID" || currentStatus === "CAPTURED") {
      return { status: "captured", data }
    }

    if (currentStatus === "CANCELLED" || currentStatus === "EXPIRED") {
      return { status: "canceled", data }
    }

    // Check expiration
    const expiredAt = data.expiredAt as number | undefined
    if (expiredAt && Math.floor(Date.now() / 1000) > expiredAt) {
      return {
        status: "canceled",
        data: {
          ...data,
          status: "EXPIRED",
        },
      }
    }

    return { status: "pending", data }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return {
      data: {
        ...(input.data || {}),
        captured_at: new Date().toISOString(),
        status: "CAPTURED",
      },
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return {
      data: {
        ...(input.data || {}),
        refunded_at: new Date().toISOString(),
        refund_amount: input.amount,
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return {
      data: {
        ...(input.data || {}),
        canceled_at: new Date().toISOString(),
        status: "CANCELLED",
      },
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return {
      data: {
        ...(input.data || {}),
        deleted_at: new Date().toISOString(),
      },
    }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return {
      data: input.data || {},
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const amount = Math.round(Number(input.amount))
    const currentData = (input.data || {}) as Record<string, unknown>
    const { client, settings } = await this.getClient()

    const description = String(currentData.description || "")
    const qrCode = client.generateVietQrUrl({
      amount,
      description,
      bankCode: settings.bank_code,
      accountNumber: settings.account_number,
      accountHolderName: settings.account_holder_name,
    })

    return {
      data: {
        ...currentData,
        amount,
        qrCode,
      },
    }
  }

  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const rawData = (webhookData as any)?.rawData || webhookData
    const payload = rawData as SepayWebhookPayload

    if (!payload) {
      return { action: "not_supported" }
    }

    if (payload.transferType === "in" && payload.transferAmount) {
      const { client, settings } = await this.getClient()
      const content = String(payload.content || payload.description || payload.code || "")
      const { orderCode } = client.extractOrderCodeFromContent(
        content,
        settings.order_prefix || "DH"
      )

      if (orderCode || payload.code) {
        return {
          action: "captured",
          data: {
            session_id: String(orderCode || payload.code),
            amount: payload.transferAmount,
          },
        }
      }
    }

    return {
      action: "not_supported",
    }
  }
}

export default SepayPaymentProviderService
