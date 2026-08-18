import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function testInitiatePaymentProvider({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const paymentModule = container.resolve(Modules.PAYMENT) as any

  logger.info("Resolving payment module and providers...")

  try {
    const paymentCollection = await paymentModule.createPaymentCollections({
      currency_code: "vnd",
      amount: 500000,
    })

    logger.info(`Payment collection created: ${paymentCollection.id}`)

    const session = await paymentModule.createPaymentSession(paymentCollection.id, {
      provider_id: "pp_payos_payos",
      amount: 500000,
      currency_code: "vnd",
      data: {},
      context: {
        customer: {
          email: "test@example.com",
        },
      },
    })

    logger.info(`Payment session created successfully: ${JSON.stringify(session, null, 2)}`)
  } catch (err: any) {
    logger.error(`Failed to create payment session: ${err.message}`)
    console.error(err.stack)
  }
}
