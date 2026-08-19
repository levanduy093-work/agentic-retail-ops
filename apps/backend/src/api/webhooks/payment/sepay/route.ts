import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { getSepaySettings } from "../../../../modules/payment-hub/sepay-connection"
import { SepayClient, type SepayWebhookPayload } from "../../../../modules/sepay-payment/sepay-client"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const payload = req.body as SepayWebhookPayload

  if (!payload || (!payload.content && !payload.transaction_content && !payload.code && !payload.description)) {
    res.status(400).json({ success: false, message: "Invalid SePay webhook payload" })
    return
  }

  try {
    const settings = await getSepaySettings(req.scope)
    const client = new SepayClient({
      apiKey: settings.api_key,
      accountNumber: settings.account_number,
      bankCode: settings.bank_code,
    })

    // Check authorization header if API key is configured
    const authHeader = req.headers["authorization"] as string | undefined
    if (settings.api_key && authHeader) {
      const isValidAuth = client.verifyWebhookAuthorization(authHeader)
      if (!isValidAuth) {
        logger.warn(`[SePay Webhook] Invalid Authorization token received: "${authHeader}"`)
        // If auth token is invalid, reject with 401
        res.status(401).json({ success: false, message: "Invalid authorization token" })
        return
      }
    }

    // Only process incoming transfers (tiền vào)
    const transferType = payload.transferType || payload.transfer_type
    if (transferType && transferType !== "in") {
      logger.info(`[SePay Webhook] Ignoring non-incoming transfer: ${transferType}`)
      res.status(200).json({ success: true, message: "Ignored outgoing transfer" })
      return
    }

    const transferAmount = Number(payload.transferAmount || payload.amount_in || 0)
    const content = String(
      payload.transaction_content ||
      payload.content ||
      payload.description ||
      payload.code ||
      ""
    )
    const { orderCode, fullCode } = client.extractOrderCodeFromContent(
      content,
      settings.order_prefix || "DH"
    )

    logger.info(
      `[SePay Webhook] Received payment: Amount ${transferAmount} VND, Content: "${content}", Extracted OrderCode: ${orderCode || "none"}`
    )

    if (!orderCode && !payload.code) {
      logger.warn(`[SePay Webhook] Could not extract order code from content: "${content}"`)
      res.status(200).json({
        success: true,
        message: "Webhook received but no order code could be extracted",
      })
      return
    }

    const targetCode = orderCode || payload.code
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id", "amount", "captured_at", "data"],
    })

    const matchedPayment = payments.find((p: any) => {
      const pData = p.data || {}
      return (
        String(pData.orderCode) === String(targetCode) ||
        String(pData.order_code) === String(targetCode) ||
        String(pData.description) === String(fullCode) ||
        (fullCode && String(pData.description).includes(fullCode))
      )
    })

    if (matchedPayment) {
      if (matchedPayment.captured_at) {
        logger.info(`[SePay Webhook] Payment ${matchedPayment.id} for order ${targetCode} already captured.`)
        res.status(200).json({
          success: true,
          message: "Payment already captured",
          payment_id: matchedPayment.id,
        })
        return
      }

      logger.info(
        `[SePay Webhook] Capturing payment ${matchedPayment.id} for order ${targetCode} with amount ${transferAmount}`
      )

      await capturePaymentWorkflow(req.scope).run({
        input: {
          payment_id: matchedPayment.id,
          amount: transferAmount || matchedPayment.amount,
          captured_by: "sepay-webhook",
        },
      })

      res.status(200).json({
        success: true,
        message: "Payment captured successfully",
        payment_id: matchedPayment.id,
      })
      return
    }

    // If payment record is not yet in payment table (e.g. cart session), return 200 so SePay acknowledges
    logger.info(
      `[SePay Webhook] Payment session acknowledged for orderCode: ${targetCode}. Cart will be auto-completed via polling or status check.`
    )
    res.status(200).json({
      success: true,
      message: `Webhook acknowledged for order ${targetCode}`,
    })
  } catch (error: any) {
    logger.error(`[SePay Webhook] Error processing webhook: ${error?.message || error}`)
    res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    })
  }
}
