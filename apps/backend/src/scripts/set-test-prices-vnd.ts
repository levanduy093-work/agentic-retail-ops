import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function setTestPricesVnd({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  logger.info("Setting all VND product prices to between 2,000 VND and 7,000 VND...")

  const prices = await knex("price").where({ currency_code: "vnd" })
  logger.info(`Found ${prices.length} VND price records in database.`)

  const testPriceLevels = [2000, 3000, 4000, 5000, 6000, 7000]

  let count = 0
  for (let i = 0; i < prices.length; i++) {
    const price = prices[i]
    const newPrice = testPriceLevels[i % testPriceLevels.length]
    await knex("price")
      .where({ id: price.id })
      .update({
        amount: newPrice,
        raw_amount: {
          value: String(newPrice),
          precision: 20,
        },
      })
    count++
  }

  logger.info(`Successfully updated all ${count} product prices to 2,000 - 7,000 VND!`)
}
