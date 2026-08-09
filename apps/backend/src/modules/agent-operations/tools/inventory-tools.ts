import type { IInventoryService } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"

export const InventoryGetPositionInput = z.strictObject({
  inventory_item_id: z.string().min(1),
  location_ids: z.array(z.string().min(1)).min(1),
})

export const InventoryTransferInput = z.strictObject({
  inventory_item_id: z.string().min(1),
  quantity: z.number().int().positive(),
  source_location_id: z.string().min(1),
  target_location_id: z.string().min(1),
})

export type InventoryGetPositionInput = z.infer<
  typeof InventoryGetPositionInput
>
export type InventoryTransferInput = z.infer<typeof InventoryTransferInput>

export type InventoryPosition = {
  available_quantity: number | null
  exists: boolean
  incoming_quantity: number | null
  inventory_item_id: string
  location_id: string
  reserved_quantity: number | null
  stocked_quantity: number | null
}

export type InventoryTransferEvaluation =
  | {
      allowed: true
      source: InventoryPosition
      target: InventoryPosition
    }
  | {
      allowed: false
      code:
        | "INVENTORY_LEVEL_MISSING"
        | "SAME_LOCATION"
        | "SOURCE_INSUFFICIENT"
      message: string
      source: InventoryPosition | null
      target: InventoryPosition | null
    }

export const INVENTORY_GET_POSITION_TOOL = {
  kind: "READ" as const,
  name: "inventory.get-position",
  permission: "agent_inventory:read",
  risk_level: "READ_ONLY" as const,
  version: "1.0.0",
}

export const INVENTORY_EXECUTE_TRANSFER_TOOL = {
  approval_required: true,
  kind: "COMMAND" as const,
  name: "inventory.execute-transfer",
  permission: "agent_inventory:transfer",
  required_role: "operations_manager",
  risk_level: "HIGH" as const,
  version: "1.0.0",
}

export async function getInventoryPositions(
  inventoryService: IInventoryService,
  input: InventoryGetPositionInput
): Promise<InventoryPosition[]> {
  const parsed = InventoryGetPositionInput.parse(input)
  const locationIds = [...new Set(parsed.location_ids)]
  const levels = await inventoryService.listInventoryLevels(
    {
      inventory_item_id: parsed.inventory_item_id,
      location_id: locationIds,
    },
    {
      select: [
        "available_quantity",
        "incoming_quantity",
        "inventory_item_id",
        "location_id",
        "reserved_quantity",
        "stocked_quantity",
      ],
      take: locationIds.length,
    }
  )
  const levelsByLocation = new Map(
    levels.map((level) => [level.location_id, level])
  )

  return locationIds.map((locationId) => {
    const level = levelsByLocation.get(locationId)

    return {
      available_quantity: level?.available_quantity ?? null,
      exists: !!level,
      incoming_quantity: level?.incoming_quantity ?? null,
      inventory_item_id: parsed.inventory_item_id,
      location_id: locationId,
      reserved_quantity: level?.reserved_quantity ?? null,
      stocked_quantity: level?.stocked_quantity ?? null,
    }
  })
}

export function evaluateInventoryTransfer(
  input: InventoryTransferInput,
  positions: InventoryPosition[]
): InventoryTransferEvaluation {
  const parsed = InventoryTransferInput.parse(input)

  if (parsed.source_location_id === parsed.target_location_id) {
    return {
      allowed: false,
      code: "SAME_LOCATION",
      message: "Source and target inventory locations must be different.",
      source: null,
      target: null,
    }
  }

  const source =
    positions.find(
      (position) => position.location_id === parsed.source_location_id
    ) ?? null
  const target =
    positions.find(
      (position) => position.location_id === parsed.target_location_id
    ) ?? null

  if (!source?.exists || !target?.exists) {
    return {
      allowed: false,
      code: "INVENTORY_LEVEL_MISSING",
      message: "The source or target inventory level no longer exists.",
      source,
      target,
    }
  }

  if (
    source.available_quantity === null ||
    source.available_quantity < parsed.quantity
  ) {
    return {
      allowed: false,
      code: "SOURCE_INSUFFICIENT",
      message: "The source location no longer has enough available inventory.",
      source,
      target,
    }
  }

  return { allowed: true, source, target }
}
