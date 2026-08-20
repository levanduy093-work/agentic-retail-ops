import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function inspectData({ container }: ExecArgs) {
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  if (pgConnection) {
    const tablesRes = await pgConnection.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `)
    
    const tableNames = tablesRes.rows.map((r: any) => r.table_name)
    console.log("All tables in database:", tableNames)

    const orderRelated = tableNames.filter((t: string) => 
      t.includes("order") || 
      t.includes("fulfill") || 
      t.includes("shipping") || 
      t.includes("cart") || 
      t.includes("payment") || 
      t.includes("return") || 
      t.includes("claim") ||
      t.includes("exchange") ||
      t.includes("draft")
    )

    console.log("\nCounts for order/fulfillment/shipping/cart/payment related tables:")
    for (const t of orderRelated) {
      try {
        const countRes = await pgConnection(t).count("* as count").first()
        console.log(`- ${t}: ${countRes?.count || 0}`)
      } catch (e: any) {
        console.log(`- ${t}: error ${e.message}`)
      }
    }
  }
}
