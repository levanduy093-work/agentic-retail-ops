import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function inspectOrder({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "payment_status",
      "total",
      "payment_collections.*",
      "payment_collections.payments.*",
    ],
  })

  logger.info(`Orders in database (${orders.length}):`)
  for (const o of orders) {
    logger.info(`Order ${o.id} (#${o.display_id}): status=${o.status}, payment_status=${o.payment_status}, total=${o.total}`)
    logger.info(`Payment collections: ${JSON.stringify(o.payment_collections, null, 2)}`)
  }
}
