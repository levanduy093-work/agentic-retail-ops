import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
export default async function testCart({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["shipping_methods.data", "shipping_methods.amount"],
    pagination: { take: 1, order: { created_at: "DESC" } }
  })
  console.log(JSON.stringify(carts, null, 2))
}
