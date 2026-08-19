import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getSepaySettings } from "../modules/payment-hub/sepay-connection"
import { SepayClient } from "../modules/sepay-payment/sepay-client"

export default async function debugSepay({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const settings = await getSepaySettings(container)
  logger.info(`SePay Settings: is_enabled=${settings.is_enabled}, bank_code=${settings.bank_code}, account_number=${settings.account_number}, hasApiKey=${Boolean(settings.api_key)}`)

  const client = new SepayClient({
    apiKey: settings.api_key,
    accountNumber: settings.account_number,
    bankCode: settings.bank_code,
  })

  logger.info("Fetching recent transactions from SePay...")
  const txs = await client.getRecentTransactions(20)
  logger.info(`Found ${txs.length} transactions: ${JSON.stringify(txs, null, 2)}`)

  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "amount", "captured_at", "data"],
  })
  logger.info(`Found ${payments.length} payments in database: ${JSON.stringify(payments.slice(0, 5), null, 2)}`)
}
