import { createHmac } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

export type PayosConfig = {
  clientId: string
  apiKey: string
  checksumKey: string
  environment?: "sandbox" | "production"
  baseUrl?: string
}

export type PayosCheckoutItem = {
  name: string
  quantity: number
  price: number
}

export type CreatePaymentLinkRequest = {
  orderCode: number
  amount: number
  description: string
  buyerName?: string
  buyerEmail?: string
  buyerPhone?: string
  buyerAddress?: string
  items?: PayosCheckoutItem[]
  cancelUrl: string
  returnUrl: string
  expiredAt?: number
}

export type PayosPaymentLinkData = {
  bin: string
  accountNumber: string
  accountName: string
  amount: number
  description: string
  orderCode: number
  currency: string
  paymentLinkId: string
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED"
  checkoutUrl: string
  qrCode: string
}

export type PayosWebhookData = {
  orderCode: number
  amount: number
  description: string
  accountNumber: string
  reference: string
  transactionDateTime: string
  currency: string
  paymentLinkId: string
  code: string
  desc: string
}

export type PayosWebhookPayload = {
  code: string
  desc: string
  data: PayosWebhookData
  signature: string
}

export class PayosClient {
  private readonly clientId: string
  private readonly apiKey: string
  private readonly checksumKey: string
  private readonly baseUrl: string

  constructor(config: PayosConfig) {
    this.clientId = config.clientId.trim()
    this.apiKey = config.apiKey.trim()
    this.checksumKey = config.checksumKey.trim()
    this.baseUrl = (config.baseUrl || "https://api-merchant.payos.vn").replace(/\/+$/, "")
  }

  public isConfigured(): boolean {
    return Boolean(this.clientId && this.apiKey && this.checksumKey)
  }

  /**
   * Sort object keys alphabetically and create query string for signature
   */
  public createSignatureFromObj(data: Record<string, any>): string {
    const sortedKeys = Object.keys(data).sort()
    const parts = sortedKeys
      .filter((k) => data[k] !== undefined && data[k] !== null && data[k] !== "")
      .map((k) => `${k}=${data[k]}`)
    const stringToSign = parts.join("&")
    return createHmac("sha256", this.checksumKey)
      .update(stringToSign)
      .digest("hex")
  }

  /**
   * Create signature for creating payment link
   */
  public createPaymentLinkSignature(params: {
    amount: number
    cancelUrl: string
    description: string
    orderCode: number
    returnUrl: string
  }): string {
    const stringToSign = `amount=${params.amount}&cancelUrl=${params.cancelUrl}&description=${params.description}&orderCode=${params.orderCode}&returnUrl=${params.returnUrl}`
    return createHmac("sha256", this.checksumKey)
      .update(stringToSign)
      .digest("hex")
  }

  /**
   * Verify incoming webhook data
   */
  public verifyWebhookData(webhookPayload: PayosWebhookPayload): boolean {
    if (!webhookPayload || !webhookPayload.data || !webhookPayload.signature) {
      return false
    }
    const signature = this.createSignatureFromObj(webhookPayload.data)
    return signature === webhookPayload.signature
  }

  /**
   * Create payment link / QR code on PayOS
   */
  public async createPaymentLink(
    request: CreatePaymentLinkRequest
  ): Promise<PayosPaymentLinkData> {
    if (!this.isConfigured()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayOS is not configured with valid Client ID, API Key, and Checksum Key."
      )
    }

    const signature = this.createPaymentLinkSignature({
      amount: request.amount,
      cancelUrl: request.cancelUrl,
      description: request.description,
      orderCode: request.orderCode,
      returnUrl: request.returnUrl,
    })

    const body: Record<string, any> = {
      orderCode: request.orderCode,
      amount: request.amount,
      description: request.description,
      cancelUrl: request.cancelUrl,
      returnUrl: request.returnUrl,
      signature,
    }

    if (request.buyerName) body.buyerName = request.buyerName
    if (request.buyerEmail) body.buyerEmail = request.buyerEmail
    if (request.buyerPhone) body.buyerPhone = request.buyerPhone
    if (request.buyerAddress) body.buyerAddress = request.buyerAddress
    if (request.items && request.items.length > 0) body.items = request.items
    if (request.expiredAt) body.expiredAt = request.expiredAt

    const response = await fetch(`${this.baseUrl}/v2/payment-requests`, {
      method: "POST",
      headers: {
        "x-client-id": this.clientId,
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = (await response.json()) as {
      code: string
      desc: string
      data?: PayosPaymentLinkData
    }

    if (result.code !== "00" || !result.data) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `PayOS createPaymentLink error (${result.code}): ${result.desc || "Unknown error"}`
      )
    }

    return result.data
  }

  /**
   * Get payment link information from PayOS
   */
  public async getPaymentLinkInformation(
    orderCode: number | string
  ): Promise<PayosPaymentLinkData> {
    if (!this.isConfigured()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayOS is not configured."
      )
    }

    const response = await fetch(`${this.baseUrl}/v2/payment-requests/${orderCode}`, {
      method: "GET",
      headers: {
        "x-client-id": this.clientId,
        "x-api-key": this.apiKey,
      },
    })

    const result = (await response.json()) as {
      code: string
      desc: string
      data?: PayosPaymentLinkData
    }

    if (result.code !== "00" || !result.data) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `PayOS getPaymentLinkInformation error (${result.code}): ${result.desc || "Unknown error"}`
      )
    }

    return result.data
  }

  /**
   * Cancel payment link
   */
  public async cancelPaymentLink(
    orderCode: number | string,
    cancellationReason?: string
  ): Promise<PayosPaymentLinkData> {
    if (!this.isConfigured()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayOS is not configured."
      )
    }

    const response = await fetch(`${this.baseUrl}/v2/payment-requests/${orderCode}/cancel`, {
      method: "POST",
      headers: {
        "x-client-id": this.clientId,
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancellationReason: cancellationReason || "Order cancelled by customer or system",
      }),
    })

    const result = (await response.json()) as {
      code: string
      desc: string
      data?: PayosPaymentLinkData
    }

    if (result.code !== "00" || !result.data) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `PayOS cancelPaymentLink error (${result.code}): ${result.desc || "Unknown error"}`
      )
    }

    return result.data
  }

  /**
   * Verify credentials by querying or testing
   */
  public async verifyCredentials(): Promise<{
    success: boolean
    message: string
    latencyMs?: number
  }> {
    const startTime = Date.now()
    if (!this.isConfigured()) {
      return {
        success: false,
        message: "Missing Client ID, API Key, or Checksum Key.",
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/v2/payment-requests/0`, {
        method: "GET",
        headers: {
          "x-client-id": this.clientId,
          "x-api-key": this.apiKey,
        },
      })

      const latencyMs = Date.now() - startTime
      const result = await response.json()

      if (response.status === 401 || response.status === 403 || result.code === "401" || result.code === "403") {
        return {
          success: false,
          message: result.desc || "Invalid Client ID or API Key.",
          latencyMs,
        }
      }

      return {
        success: true,
        message: "Connected to PayOS successfully.",
        latencyMs,
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to reach PayOS server.",
        latencyMs: Date.now() - startTime,
      }
    }
  }
}
