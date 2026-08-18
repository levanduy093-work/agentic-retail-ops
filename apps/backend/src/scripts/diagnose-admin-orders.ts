import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
export default async function diagnose({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: fulfillments } = await query.graph({ entity: "fulfillment", fields: ["id", "provider_id", "order_id", "status"], pagination: { take: 5, order: { created_at: "DESC" } } })
  console.log("Fulfillments:", JSON.stringify(fulfillments, null, 2))
  
  const { data: sets } = await query.graph({ entity: "fulfillment_set", fields: ["id", "order.id", "fulfillments.id"], pagination: { take: 5, order: { created_at: "DESC" } } })
  console.log("Fulfillment Sets:", JSON.stringify(sets, null, 2))
}
