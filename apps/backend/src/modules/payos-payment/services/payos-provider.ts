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
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { PayosClient, type PayosWebhookPayload } from "../payos-client"
import { getPayosSettings, type PayosFullSettings } from "../../payment-hub/payos-connection"

export type PayosProviderOptions = {
  client_id?: string
  api_key?: string
  checksum_key?: string
  environment?: "sandbox" | "production"
  base_url?: string
}

export class PayosPaymentProviderService extends AbstractPaymentProvider<PayosProviderOptions> {
  static identifier = "payos"

  protected options_: PayosProviderOptions
  protected container_: Record<string, unknown>

  constructor(container: Record<string, unknown>, options: PayosProviderOptions = {}) {
    super(container, options)
    this.container_ = container
    this.options_ = options
  }

  private async getClient(): Promise<{ client: PayosClient; settings: PayosFullSettings }> {
    const settings = await getPayosSettings(this.container_)
    const client = new PayosClient({
      clientId: this.options_.client_id || settings.client_id,
      apiKey: this.options_.api_key || settings.api_key,
      checksumKey: this.options_.checksum_key || settings.checksum_key,
      environment: this.options_.environment || settings.environment,
      baseUrl: this.options_.base_url,
    })
    return { client, settings }
  }

  /**
   * Generates a unique numeric orderCode for PayOS (max safe int)
   */
  private generateOrderCode(): number {
    // Generate a 9-digit safe integer from timestamp + random salt
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
        "PayOS credentials are not configured. Please configure them in the Admin Dashboard."
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

    const returnUrl = (input.context as any)?.return_url || "https://localhost:8000/checkout"
    const cancelUrl = (input.context as any)?.cancel_url || "https://localhost:8000/checkout"

    try {
      const paymentLink = await client.createPaymentLink({
        orderCode,
        amount,
        description,
        cancelUrl,
        returnUrl,
        expiredAt,
      })

      return {
        id: String(orderCode),
        data: {
          orderCode,
          amount,
          description,
          bin: paymentLink.bin,
          accountNumber: paymentLink.accountNumber,
          accountName: paymentLink.accountName,
          checkoutUrl: paymentLink.checkoutUrl,
          qrCode: paymentLink.qrCode,
          paymentLinkId: paymentLink.paymentLinkId,
          expiredAt,
          status: paymentLink.status || "PENDING",
        },
      }
    } catch (error: any) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to create PayOS payment link: ${error.message}`
      )
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

    const orderCode = data.orderCode as string | number | undefined
    if (!orderCode) {
      return { status: "pending", data }
    }

    const { client } = await this.getClient()
    if (!client.isConfigured()) {
      return { status: "pending", data }
    }

    try {
      const info = await client.getPaymentLinkInformation(orderCode)
      if (info.status === "PAID") {
        return {
          status: "captured",
          data: {
            ...data,
            ...info,
            status: "PAID",
          },
        }
      }
      if (info.status === "CANCELLED" || info.status === "EXPIRED") {
        return {
          status: "canceled",
          data: {
            ...data,
            ...info,
            status: info.status,
          },
        }
      }
    } catch {
      // Return existing status if query fails
    }

    return { status: "pending", data }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return {
      data: {
        ...(input.data || {}),
        status: "CAPTURED",
        captured_at: new Date().toISOString(),
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data || {}) as Record<string, unknown>
    const orderCode = data.orderCode as string | number | undefined

    if (orderCode) {
      const { client } = await this.getClient()
      if (client.isConfigured()) {
        try {
          await client.cancelPaymentLink(orderCode, "Payment cancelled by customer/system")
        } catch {
          // Ignore if already cancelled or expired
        }
      }
    }

    return {
      data: {
        ...data,
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
      },
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return {
      data: input.data || {},
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return {
      data: {
        ...(input.data || {}),
        refunded_amount: input.amount,
        refunded_at: new Date().toISOString(),
      },
    }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = (input.data || {}) as Record<string, unknown>
    const orderCode = data.orderCode as string | number | undefined

    if (orderCode) {
      const { client } = await this.getClient()
      if (client.isConfigured()) {
        try {
          const info = await client.getPaymentLinkInformation(orderCode)
          return {
            data: {
              ...data,
              ...info,
            },
          }
        } catch {
          // Fall through
        }
      }
    }

    return { data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return {
      data: {
        ...(input.data || {}),
        amount: input.amount,
      },
    }
  }

  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { client } = await this.getClient()
    const rawData = (webhookData as any)?.rawData || webhookData
    const payload = rawData as PayosWebhookPayload

    if (!client.verifyWebhookData(payload)) {
      return {
        action: "not_supported",
      }
    }

    const { data } = payload
    if (payload.code === "00" && data) {
      return {
        action: "captured",
        data: {
          session_id: String(data.orderCode),
          amount: data.amount,
        },
      }
    }

    return {
      action: "not_supported",
    }
  }
}

export default PayosPaymentProviderService
