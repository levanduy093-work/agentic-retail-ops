import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
export default async function checkShipping({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  
  try {
    const { data: shippings } = await query.graph({ 
      entity: "order_shipping", 
      fields: ["*"], 
      pagination: { take: 5, order: { created_at: "DESC" } } 
    })
    console.log("OrderShippings:", JSON.stringify(shippings, null, 2))
  } catch(e: any) {
    console.log(e.message)
  }
}
