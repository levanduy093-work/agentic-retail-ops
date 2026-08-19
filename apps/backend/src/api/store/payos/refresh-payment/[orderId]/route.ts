import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getPayosSettings } from "../../../../../modules/payment-hub/payos-connection"
import { PayosClient } from "../../../../../modules/payos-payment/payos-client"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { orderId } = req.params

  if (!orderId) {
    res.status(400).json({
      success: false,
      message: "Missing orderId parameter",
    })
    return
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "total",
        "payment_status",
        "currency_code",
        "payment_collections.id",
        "payment_collections.payments.id",
        "payment_collections.payments.amount",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.data",
      ],
      filters: { id: orderId },
    })

    const order = orders?.[0] as
      | (Record<string, any> & { payment_status?: string })
      | undefined
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      })
      return
    }

    if (order.payment_status === "captured") {
      res.status(400).json({
        success: false,
        message: "Order is already paid",
      })
      return
    }

    const settings = await getPayosSettings(req.scope)
    const client = new PayosClient({
      clientId: settings.client_id,
      apiKey: settings.api_key,
      checksumKey: settings.checksum_key,
      environment: settings.environment,
    })

    if (!client.isConfigured()) {
      res.status(400).json({
        success: false,
        message: "PayOS is not configured",
      })
      return
    }

    // Generate unique numeric orderCode
    const now = Date.now()
    const slice = String(now).slice(-6)
    const random = Math.floor(100 + Math.random() * 900)
    const orderCode = Number(`${slice}${random}`)

    const timeoutMinutes =
      settings.is_timeout_enabled && settings.timeout_minutes > 0
        ? settings.timeout_minutes
        : 15
    const expiredAt = Math.floor(Date.now() / 1000) + timeoutMinutes * 60

    const prefix = (settings.order_prefix || "DH").replace(/[^a-zA-Z0-9]/g, "")
    const description = `${prefix}${orderCode}`.slice(0, 25)
    const amount = Math.round(Number(order.total))

    const paymentLink = await client.createPaymentLink({
      orderCode,
      amount,
      description,
      cancelUrl: "https://localhost:8000/account/orders",
      returnUrl: "https://localhost:8000/account/orders",
      expiredAt,
    })

    const newPaymentData = {
      orderCode,
      amount,
      description,
      bin: paymentLink.bin || "970422",
      accountNumber: paymentLink.accountNumber,
      accountName: paymentLink.accountName,
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      paymentLinkId: paymentLink.paymentLinkId,
      expiredAt,
      status: paymentLink.status || "PENDING",
    }

    const payment = order.payment_collections?.[0]?.payments?.[0]
    if (payment) {
      try {
        const paymentModuleService = req.scope.resolve(Modules.PAYMENT) as any
        if (paymentModuleService?.updatePayments) {
          await paymentModuleService.updatePayments({
            id: payment.id,
            data: newPaymentData,
          })
        }
      } catch (updateErr: any) {
        logger.warn(
          `[PayOS Refresh Payment] Warning updating payment ${payment.id} data: ${updateErr.message}`
        )
      }
    }

    logger.info(
      `[PayOS Refresh Payment] Generated new payment link for order #${order.display_id} (${order.id}) with orderCode ${orderCode}`
    )

    res.status(200).json({
      success: true,
      data: newPaymentData,
    })
  } catch (error: any) {
    logger.error(
      `[PayOS Refresh Payment] Error refreshing payment for order ${orderId}: ${error.message}`
    )
    res.status(500).json({
      success: false,
      message: error.message || "Failed to refresh PayOS payment link",
    })
  }
}
