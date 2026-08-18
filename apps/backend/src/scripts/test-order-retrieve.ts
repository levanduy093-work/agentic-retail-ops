import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
export default async function testOrderRetrieve({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "fulfillments.id", "fulfillments.provider_id"],
    pagination: { take: 5, order: { created_at: "DESC" } }
  })
  console.log("Orders with fulfillments:", JSON.stringify(data, null, 2))
}
