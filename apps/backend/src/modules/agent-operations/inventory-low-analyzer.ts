import {
  InventoryLowPayload,
  InventoryRecommendation,
} from "./types"

export function analyzeInventoryLow(
  payload: InventoryLowPayload
): InventoryRecommendation {
  const shortfall = Math.max(
    payload.required_quantity - payload.available_quantity,
    0
  )

  const evidence = {
    alternative_locations: payload.alternative_locations,
    available_quantity: payload.available_quantity,
    inventory_item_id: payload.inventory_item_id,
    location_id: payload.location_id,
    required_quantity: payload.required_quantity,
    shortfall,
  }

  if (shortfall === 0) {
    return {
      action_type: "NO_ACTION",
      evidence,
      proposal: {},
      rationale:
        "Current availability already covers the required quantity. No inventory mutation is needed.",
      requires_approval: false,
      risk_level: "READ_ONLY",
      summary: "Inventory is sufficient after deterministic recheck.",
      terminal_status: "RESOLVED",
    }
  }

  const source = [...payload.alternative_locations]
    .filter(
      (location) =>
        location.location_id !== payload.location_id &&
        location.available_quantity >= shortfall
    )
    .sort((left, right) => right.available_quantity - left.available_quantity)[0]

  if (!source) {
    return {
      action_type: "ESCALATE",
      evidence,
      proposal: {
        inventory_item_id: payload.inventory_item_id,
        quantity: shortfall,
        target_location_id: payload.location_id,
      },
      rationale:
        "No alternative location has enough available inventory to cover the shortfall.",
      requires_approval: false,
      risk_level: "MEDIUM",
      summary: "Inventory shortfall requires manual sourcing or procurement.",
      terminal_status: "ESCALATED",
    }
  }

  return {
    action_type: "INVENTORY_TRANSFER",
    evidence,
    proposal: {
      inventory_item_id: payload.inventory_item_id,
      quantity: shortfall,
      source_available_quantity: source.available_quantity,
      source_location_id: source.location_id,
      target_location_id: payload.location_id,
    },
    rationale:
      "The selected source location covers the shortfall with the highest available quantity.",
    requires_approval: true,
    risk_level: "HIGH",
    summary: `Transfer ${shortfall} unit(s) to the at-risk location.`,
  }
}
