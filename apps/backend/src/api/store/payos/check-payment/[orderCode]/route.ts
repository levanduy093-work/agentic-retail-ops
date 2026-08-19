import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { getPayosSettings } from "../../../../../modules/payment-hub/payos-connection"
import { getSepaySettings } from "../../../../../modules/payment-hub/sepay-connection"
import { PayosClient } from "../../../../../modules/payos-payment/payos-client"
import { SepayClient } from "../../../../../modules/sepay-payment/sepay-client"

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
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    // 1. Check if the payment has already been captured in database (e.g. by Webhook)
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id", "amount", "captured_at", "data"],
    })

    const matchedPayment = payments.find(
      (p: any) =>
        String(p.data?.orderCode) === String(orderCode) ||
        String(p.data?.order_code) === String(orderCode) ||
        p.data?.orderCode == numericOrderCode ||
        p.data?.order_code == numericOrderCode
    )

    if (matchedPayment?.captured_at) {
      res.status(200).json({
        success: true,
        orderCode: numericOrderCode || orderCode,
        status: "PAID",
        is_paid: true,
        amount: matchedPayment.amount,
      })
      return
    }

    // 2. Check if PayOS is configured and query PayOS directly
    const payosSettings = await getPayosSettings(req.scope)
    if (payosSettings.is_enabled && payosSettings.client_id && payosSettings.api_key) {
      const client = new PayosClient({
        clientId: payosSettings.client_id,
        apiKey: payosSettings.api_key,
        checksumKey: payosSettings.checksum_key,
        environment: payosSettings.environment,
      })

      if (client.isConfigured() && !isNaN(numericOrderCode)) {
        const paymentInfo = await client.getPaymentLinkInformation(numericOrderCode)
        const isPaid = paymentInfo.status === "PAID"

        if (isPaid && matchedPayment && !matchedPayment.captured_at) {
          logger.info(
            `[Status Check] Auto-capturing payment ${matchedPayment.id} for orderCode ${numericOrderCode}`
          )
          await capturePaymentWorkflow(req.scope).run({
            input: {
              payment_id: matchedPayment.id,
              amount: matchedPayment.amount,
              captured_by: "payos-status-check",
            },
          })
        }

        if (isPaid) {
          res.status(200).json({
            success: true,
            orderCode: numericOrderCode,
            status: paymentInfo.status,
            is_paid: true,
            amount: paymentInfo.amount,
            currency: paymentInfo.currency,
            paymentLinkId: paymentInfo.paymentLinkId,
          })
          return
        }
      }
    }

    // 3. Fallback / Active Check for SePay: Query SePay API directly for recent transactions
    const sepaySettings = await getSepaySettings(req.scope)
    if (sepaySettings.is_enabled && sepaySettings.api_key) {
      const client = new SepayClient({
        apiKey: sepaySettings.api_key,
        accountNumber: sepaySettings.account_number,
        bankCode: sepaySettings.bank_code,
      })

      if (client.isConfigured()) {
        const transactions = await client.getRecentTransactions(30)
        const matchedTx = transactions.find((tx) => {
          const content = String(
            tx.transaction_content ||
            tx.content ||
            tx.description ||
            tx.code ||
            ""
          )
          const { orderCode: extractedCode, fullCode } = client.extractOrderCodeFromContent(
            content,
            sepaySettings.order_prefix || "DH"
          )
          const isMatch =
            extractedCode === String(orderCode) ||
            extractedCode === String(numericOrderCode) ||
            fullCode === String(orderCode) ||
            (fullCode && String(orderCode).includes(fullCode)) ||
            content.includes(String(orderCode))

          const transferType = tx.transfer_type || tx.transferType
          const isIncoming = !transferType || transferType === "in"
          return isMatch && isIncoming
        })

        if (matchedTx) {
          const transferAmount = Number(matchedTx.amount_in || matchedTx.transferAmount || matchedPayment?.amount || 0)

          if (matchedPayment && !matchedPayment.captured_at) {
            logger.info(
              `[SePay Status Check] Matched transaction in SePay API for order ${orderCode}. Auto-capturing payment ${matchedPayment.id}`
            )
            try {
              await capturePaymentWorkflow(req.scope).run({
                input: {
                  payment_id: matchedPayment.id,
                  amount: transferAmount || matchedPayment.amount,
                  captured_by: "sepay-status-check",
                },
              })
            } catch (err: any) {
              logger.warn(`[SePay Status Check] Could not capture payment entity directly: ${err?.message}`)
            }
          }

          logger.info(`[SePay Status Check] Returning is_paid=true for order ${orderCode}`)
          res.status(200).json({
            success: true,
            orderCode: numericOrderCode || orderCode,
            status: "PAID",
            is_paid: true,
            amount: transferAmount,
          })
          return
        }
      }
    }

    // 4. If neither matched yet, return PENDING
    res.status(200).json({
      success: true,
      orderCode: numericOrderCode || orderCode,
      status: "PENDING",
      is_paid: false,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check payment status",
    })
  }
}
