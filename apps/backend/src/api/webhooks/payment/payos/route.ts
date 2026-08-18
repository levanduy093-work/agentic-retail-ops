import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { getPayosSettings } from "../../../../modules/payment-hub/payos-connection"
import { PayosClient, PayosWebhookPayload } from "../../../../modules/payos-payment/payos-client"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const payload = req.body as PayosWebhookPayload

  if (!payload || !payload.data) {
    res.status(400).json({ success: false, message: "Invalid webhook payload" })
    return
  }

  try {
    const settings = await getPayosSettings(req.scope)
    const client = new PayosClient({
      clientId: settings.client_id,
      apiKey: settings.api_key,
      checksumKey: settings.checksum_key,
      environment: settings.environment,
    })

    const isValid = client.verifyWebhookData(payload)
    if (!isValid) {
      logger.warn(`[PayOS Webhook] Invalid signature received for order ${payload.data?.orderCode}`)
      res.status(400).json({ success: false, message: "Invalid signature" })
      return
    }

    const orderCode = payload.data.orderCode
    logger.info(`[PayOS Webhook] Verified payment webhook for order ${orderCode}: Amount ${payload.data.amount} VND`)

    if (payload.code === "00") {
      try {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
        const { data: payments } = await query.graph({
          entity: "payment",
          fields: ["id", "amount", "captured_at", "data"],
        })
        const matchedPayment = payments.find(
          (p: any) =>
            p.data?.orderCode == orderCode ||
            String(p.data?.orderCode) === String(orderCode)
        )
        if (matchedPayment && !matchedPayment.captured_at) {
          logger.info(
            `[PayOS Webhook] Capturing payment ${matchedPayment.id} for orderCode ${orderCode}`
          )
          await capturePaymentWorkflow(req.scope).run({
            input: {
              payment_id: matchedPayment.id,
              amount: matchedPayment.amount,
              captured_by: "payos-webhook",
            },
          })
        }
      } catch (captureErr: any) {
        logger.warn(
          `[PayOS Webhook] Could not auto-capture payment for orderCode ${orderCode}: ${captureErr.message}`
        )
      }
    }

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    })
  } catch (error: any) {
    logger.error(`[PayOS Webhook] Error processing webhook: ${error.message}`)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

