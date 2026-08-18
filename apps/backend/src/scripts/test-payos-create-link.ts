import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getPayosSettings } from "../modules/payment-hub/payos-connection"
import { PayosClient } from "../modules/payos-payment/payos-client"

export default async function testPayosCreateLink({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const settings = await getPayosSettings(container)

  logger.info(`PayOS Settings: is_enabled=${settings.is_enabled}, client_id=${settings.client_id}, env=${settings.environment}`)

  const client = new PayosClient({
    clientId: settings.client_id,
    apiKey: settings.api_key,
    checksumKey: settings.checksum_key,
    environment: settings.environment,
  })

  logger.info(`Client configured: ${client.isConfigured()}`)

  const orderCode = Math.floor(Date.now() / 1000)
  const amount = 50000
  const description = `DH${orderCode}`.slice(0, 25)
  const cancelUrl = "http://localhost:8000/checkout"
  const returnUrl = "http://localhost:8000/checkout"

  try {
    logger.info("Attempting createPaymentLink on PayOS...")
    const link = await client.createPaymentLink({
      orderCode,
      amount,
      description,
      cancelUrl,
      returnUrl,
    })
    logger.info(`Success! QR Code: ${link.qrCode}`)
    logger.info(`Checkout URL: ${link.checkoutUrl}`)
  } catch (err: any) {
    logger.error(`Error from PayOS: ${err.message}`)
  }
}
