import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { getPayosSettings } from "../../../../../modules/payment-hub/payos-connection"
import { PayosClient } from "../../../../../modules/payos-payment/payos-client"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { orderCode } = req.params

  if (!orderCode) {
    res.status(400).json({
      success: false,
      message: "Missing orderCode parameter",
    })
    return
  }

  const numericOrderCode = Number(orderCode)
  if (isNaN(numericOrderCode)) {
    res.status(400).json({
      success: false,
      message: "orderCode must be a number",
    })
    return
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
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

    const paymentInfo = await client.getPaymentLinkInformation(numericOrderCode)
    const isPaid = paymentInfo.status === "PAID"

    if (isPaid) {
      try {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
        const { data: payments } = await query.graph({
          entity: "payment",
          fields: ["id", "amount", "captured_at", "data"],
        })
        const matchedPayment = payments.find(
          (p: any) =>
            p.data?.orderCode == numericOrderCode ||
            String(p.data?.orderCode) === String(numericOrderCode)
        )
        if (matchedPayment && !matchedPayment.captured_at) {
          logger.info(
            `[PayOS Status Check] Capturing payment ${matchedPayment.id} for orderCode ${numericOrderCode}`
          )
          await capturePaymentWorkflow(req.scope).run({
            input: {
              payment_id: matchedPayment.id,
              amount: matchedPayment.amount,
              captured_by: "payos-status-check",
            },
          })
        }
      } catch (captureErr: any) {
        logger.warn(
          `[PayOS Status Check] Could not auto-capture payment for orderCode ${numericOrderCode}: ${captureErr.message}`
        )
      }
    }

    res.status(200).json({
      success: true,
      orderCode: numericOrderCode,
      status: paymentInfo.status,
      is_paid: isPaid,
      amount: paymentInfo.amount,
      currency: paymentInfo.currency,
      paymentLinkId: paymentInfo.paymentLinkId,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check payment status",
    })
  }
}

