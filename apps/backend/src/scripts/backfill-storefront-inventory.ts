import assert from "node:assert/strict"

import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"

const DEFAULT_STOCKED_QUANTITY = 100
const INVENTORY_BATCH_SIZE = 100
const STOCK_LOCATION_NAME = "Kho hàng Việt Nam"

export default async function backfillStorefrontInventory({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = container.resolve(Modules.INVENTORY)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: STOCK_LOCATION_NAME },
    pagination: { take: 2 },
  })

  assert.equal(
    locations.length,
    1,
    `Expected exactly one stock location named ${STOCK_LOCATION_NAME}`
  )

  const stockLocation = locations[0]
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
    pagination: { take: 5_000 },
  })
  const existingLevels = await inventoryService.listInventoryLevels(
    { location_id: stockLocation.id },
    { select: ["inventory_item_id", "stocked_quantity"], take: 5_000 }
  )
  const existingItemIds = new Set(
    existingLevels.map((level) => level.inventory_item_id)
  )
  const missingItems = inventoryItems.filter(
    (item) => !existingItemIds.has(item.id)
  )

  logger.info(
    `Inventory backfill at ${stockLocation.name}: ${existingLevels.length} existing levels, ${missingItems.length} missing levels.`
  )

  for (let offset = 0; offset < missingItems.length; offset += INVENTORY_BATCH_SIZE) {
    const inventoryItemsBatch = missingItems.slice(
      offset,
      offset + INVENTORY_BATCH_SIZE
    )

    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: inventoryItemsBatch.map((item) => ({
          inventory_item_id: item.id,
          location_id: stockLocation.id,
          stocked_quantity: DEFAULT_STOCKED_QUANTITY,
        })),
      },
    })

    logger.info(
      `Created ${Math.min(offset + INVENTORY_BATCH_SIZE, missingItems.length)}/${missingItems.length} missing inventory levels.`
    )
  }

  const verifiedLevels = await inventoryService.listInventoryLevels(
    { location_id: stockLocation.id },
    { select: ["inventory_item_id", "stocked_quantity"], take: 5_000 }
  )
  const verifiedItemIds = new Set(
    verifiedLevels.map((level) => level.inventory_item_id)
  )

  assert.equal(
    inventoryItems.every((item) => verifiedItemIds.has(item.id)),
    true,
    "Some inventory items still do not have a level at the Vietnamese stock location"
  )

  logger.info(
    JSON.stringify({
      stock_location: stockLocation.name,
      inventory_items: inventoryItems.length,
      existing_levels_before: existingLevels.length,
      created_levels: missingItems.length,
      levels_after: verifiedLevels.length,
      stocked_quantity_for_created_levels: DEFAULT_STOCKED_QUANTITY,
    })
  )
}
