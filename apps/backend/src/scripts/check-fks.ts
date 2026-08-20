import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function checkForeignKeys({ container }: ExecArgs) {
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  if (pgConnection) {
    const fkRes = await pgConnection.raw(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (ccu.table_name IN ('order', 'fulfillment', 'order_change', 'order_item', 'order_line_item', 'payment', 'payment_collection')
             OR tc.table_name IN ('order', 'fulfillment', 'order_change', 'order_item', 'order_line_item', 'payment', 'payment_collection'));
    `)
    
    console.log("Foreign Key relationships involved:")
    for (const row of fkRes.rows) {
      console.log(`${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`)
    }
  }
}
