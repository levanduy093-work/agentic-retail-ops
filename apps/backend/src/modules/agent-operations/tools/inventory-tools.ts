import type { IInventoryService } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

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

export const InventoryPositionSchema = z.strictObject({
  available_quantity: z.number().nullable(),
  exists: z.boolean(),
  incoming_quantity: z.number().nullable(),
  inventory_item_id: z.string().min(1),
  location_id: z.string().min(1),
  reserved_quantity: z.number().nullable(),
  stocked_quantity: z.number().nullable(),
})

export const InventoryGetPositionOutput = z.strictObject({
  positions: z.array(InventoryPositionSchema),
})

export const InventoryTransferOutput = z.discriminatedUnion("outcome", [
  z.strictObject({
    code: z.enum([
      "INVENTORY_LEVEL_MISSING",
      "SAME_LOCATION",
      "SOURCE_INSUFFICIENT",
    ]),
    message: z.string().min(1),
    outcome: z.literal("CONFLICT"),
    positions_before: z.array(InventoryPositionSchema),
  }),
  z.strictObject({
    outcome: z.literal("SUCCEEDED"),
    positions_after: z.array(InventoryPositionSchema),
    positions_before: z.array(InventoryPositionSchema),
    quantity: z.number().int().positive(),
  }),
])

export type InventoryGetPositionInput = z.infer<
  typeof InventoryGetPositionInput
>
export type InventoryTransferInput = z.infer<typeof InventoryTransferInput>
export type InventoryGetPositionOutput = z.infer<
  typeof InventoryGetPositionOutput
>
export type InventoryPosition = z.infer<typeof InventoryPositionSchema>
export type InventoryTransferOutput = z.infer<typeof InventoryTransferOutput>

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

function toQuantity(value: unknown) {
  if (value === null || value === undefined) return null

  const quantity = Number(value)
  if (!Number.isFinite(quantity)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Inventory service returned a non-numeric quantity."
    )
  }

  return quantity
}

export const INVENTORY_GET_POSITION_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: ["inventory_item_id", "location_ids", "positions"],
  description: "Read live inventory positions for one item across locations.",
  error_codes: ["INVENTORY_READ_FAILED", "INVALID_TOOL_INPUT"],
  idempotency: "NOT_REQUIRED",
  input_schema: InventoryGetPositionInput,
  kind: "READ",
  name: "inventory.get-position",
  output_schema: InventoryGetPositionOutput,
  permission: "agent_inventory:read",
  required_role: null,
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 250,
    max_attempts: 2,
    max_delay_ms: 1_000,
  },
  risk_level: "READ_ONLY",
  timeout_ms: 5_000,
  version: "1.0.0",
})

export const INVENTORY_EXECUTE_TRANSFER_TOOL = defineAgentTool({
  approval_required: true,
  audit_fields: [
    "inventory_item_id",
    "source_location_id",
    "target_location_id",
    "quantity",
    "positions_before",
    "positions_after",
  ],
  description: "Move approved inventory between two stock locations.",
  error_codes: [
    "ACTION_GATE_REJECTED",
    "INVENTORY_LEVEL_MISSING",
    "SAME_LOCATION",
    "SOURCE_INSUFFICIENT",
  ],
  idempotency: "REQUIRED",
  input_schema: InventoryTransferInput,
  kind: "COMMAND",
  name: "inventory.execute-transfer",
  output_schema: InventoryTransferOutput,
  permission: "agent_inventory:transfer",
  required_role: "operations_manager",
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 5_000,
    max_attempts: 5,
    max_delay_ms: 15 * 60_000,
  },
  risk_level: "HIGH",
  timeout_ms: 60_000,
  version: "1.0.0",
})

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
      available_quantity: toQuantity(level?.available_quantity),
      exists: !!level,
      incoming_quantity: toQuantity(level?.incoming_quantity),
      inventory_item_id: parsed.inventory_item_id,
      location_id: locationId,
      reserved_quantity: toQuantity(level?.reserved_quantity),
      stocked_quantity: toQuantity(level?.stocked_quantity),
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
