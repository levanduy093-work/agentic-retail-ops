import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { getSepaySettings } from "../modules/payment-hub/sepay-connection"
import { SepayClient } from "../modules/sepay-payment/sepay-client"

export default async function reconcilePendingVietqrPaymentsJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const sepaySettings = await getSepaySettings(container)
    if (!sepaySettings.is_enabled || !sepaySettings.api_key) {
      return
    }

    const client = new SepayClient({
      apiKey: sepaySettings.api_key,
      accountNumber: sepaySettings.account_number,
      bankCode: sepaySettings.bank_code,
    })

    if (!client.isConfigured()) {
      return
    }

    // 1. Fetch uncaptured / pending payments
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id", "amount", "captured_at", "data", "created_at"],
    })

    const pendingPayments = payments.filter(
      (p: any) => !p.captured_at && (p.data?.orderCode || p.data?.order_code)
    )

    if (pendingPayments.length === 0) {
      return
    }

    // 2. Query recent transactions from SePay
    const recentTransactions = await client.getRecentTransactions(50)
    if (recentTransactions.length === 0) {
      return
    }

    let reconciledCount = 0

    for (const payment of pendingPayments) {
      const orderCode = String(payment.data?.orderCode || payment.data?.order_code || "")
      if (!orderCode) continue

      const matchedTx = recentTransactions.find((tx) => {
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
          extractedCode === orderCode ||
          fullCode === orderCode ||
          (fullCode && orderCode.includes(fullCode)) ||
          content.includes(orderCode)

        const transferType = tx.transfer_type || tx.transferType
        const isIncoming = !transferType || transferType === "in"
        return isMatch && isIncoming
      })

      if (matchedTx) {
        const transferAmount = Number(matchedTx.amount_in || matchedTx.transferAmount || payment.amount)
        logger.info(
          `[Reconciliation Job] Auto-capturing missed VietQR payment ${payment.id} for order ${orderCode} (Amount: ${transferAmount} VND)`
        )
        try {
          await capturePaymentWorkflow(container).run({
            input: {
              payment_id: payment.id,
              amount: transferAmount,
              captured_by: "vietqr-reconciliation-cron",
            },
          })
          reconciledCount += 1
        } catch (captureErr: any) {
          logger.error(
            `[Reconciliation Job] Failed to capture payment ${payment.id}: ${captureErr?.message}`
          )
        }
      }
    }

    if (reconciledCount > 0) {
      logger.info(
        `[Reconciliation Job] Successfully reconciled ${reconciledCount} missed payment(s).`
      )
    }
  } catch (error: any) {
    logger.error(
      `[Reconciliation Job] Error during payment reconciliation: ${error?.message}`
    )
  }
}

export const config = {
  name: "reconcile-pending-vietqr-payments",
  schedule: "*/2 * * * *",
}
