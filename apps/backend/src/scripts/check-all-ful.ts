import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
export default async function checkFulf({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const result = await query.graph({
    entity: "fulfillment",
    fields: ["id", "data", "provider_id", "created_at"],
    pagination: { skip: 0, take: 50, order: { created_at: "DESC" } }
  })
  console.log("Found:", result.data.length);
  console.log(result.data.slice(0, 10));
}
