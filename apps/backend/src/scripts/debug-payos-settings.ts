import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getPayosSettings } from "../modules/payment-hub/payos-connection"

export default async function debugPayosSettings({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info("Calling getPayosSettings with root container...")
  const settings = await getPayosSettings(container)
  logger.info(`Result from root container: ${JSON.stringify(settings, null, 2)}`)

  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  logger.info("Direct pg query:")
  const rows = await pg("payment_provider_connection").select("*")
  logger.info(`Found rows: ${JSON.stringify(rows, null, 2)}`)

  const cradle = {
    __pg_connection__: pg,
  }
  logger.info("Calling getPayosSettings with cradle proxy-like object...")
  const settingsFromCradle = await getPayosSettings(cradle)
  logger.info(`Result from cradle: ${JSON.stringify(settingsFromCradle, null, 2)}`)
}
