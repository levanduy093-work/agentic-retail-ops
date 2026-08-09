import {
  evaluateInventoryTransfer,
  InventoryPosition,
  InventoryTransferInput,
} from "../tools/inventory-tools"

const input: InventoryTransferInput = {
  inventory_item_id: "iitem_test",
  quantity: 5,
  source_location_id: "sloc_source",
  target_location_id: "sloc_target",
}

function position(
  locationId: string,
  availableQuantity: number
): InventoryPosition {
  return {
    available_quantity: availableQuantity,
    exists: true,
    incoming_quantity: 0,
    inventory_item_id: input.inventory_item_id,
    location_id: locationId,
    reserved_quantity: 0,
    stocked_quantity: availableQuantity,
  }
}

describe("typed inventory tools", () => {
  test("allows a transfer when live source availability covers the quantity", () => {
    const result = evaluateInventoryTransfer(input, [
      position(input.source_location_id, 10),
      position(input.target_location_id, 1),
    ])

    expect(result.allowed).toBe(true)
  })

  test("returns a safe conflict when source availability changed", () => {
    const result = evaluateInventoryTransfer(input, [
      position(input.source_location_id, 4),
      position(input.target_location_id, 1),
    ])

    expect(result).toMatchObject({
      allowed: false,
      code: "SOURCE_INSUFFICIENT",
    })
  })

  test("returns a safe conflict when an inventory level is missing", () => {
    const result = evaluateInventoryTransfer(input, [
      position(input.source_location_id, 10),
    ])

    expect(result).toMatchObject({
      allowed: false,
      code: "INVENTORY_LEVEL_MISSING",
    })
  })

  test("rejects a transfer to the same location", () => {
    const result = evaluateInventoryTransfer(
      { ...input, target_location_id: input.source_location_id },
      [position(input.source_location_id, 10)]
    )

    expect(result).toMatchObject({ allowed: false, code: "SAME_LOCATION" })
  })
})
