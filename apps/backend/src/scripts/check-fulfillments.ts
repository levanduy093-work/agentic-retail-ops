import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
export default async function checkFulf({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "provider_id", "order_id", "canceled_at"],
    pagination: { take: 10, order: { created_at: "DESC" } }
  })
  console.log("Fulfillments via graph:", JSON.stringify(data, null, 2))
}
