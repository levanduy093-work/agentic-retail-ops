import { analyzeInventoryLow } from "../inventory-low-analyzer"

describe("inventory low analyzer", () => {
  it("proposes an approval-gated transfer from the strongest location", () => {
    const result = analyzeInventoryLow({
      alternative_locations: [
        { available_quantity: 12, location_id: "loc_hn" },
        { available_quantity: 20, location_id: "loc_dn" },
      ],
      available_quantity: 2,
      inventory_item_id: "iitem_1",
      location_id: "loc_hcm",
      required_quantity: 12,
    })

    expect(result.action_type).toBe("INVENTORY_TRANSFER")
    expect(result.risk_level).toBe("HIGH")
    expect(result.requires_approval).toBe(true)
    expect(result.proposal).toMatchObject({
      quantity: 10,
      source_location_id: "loc_dn",
      target_location_id: "loc_hcm",
    })
  })

  it("escalates when no location can cover the shortfall", () => {
    const result = analyzeInventoryLow({
      alternative_locations: [
        { available_quantity: 3, location_id: "loc_hn" },
      ],
      available_quantity: 2,
      inventory_item_id: "iitem_1",
      location_id: "loc_hcm",
      required_quantity: 12,
    })

    expect(result.action_type).toBe("ESCALATE")
    expect(result.terminal_status).toBe("ESCALATED")
    expect(result.requires_approval).toBe(false)
  })

  it("resolves without mutation when availability is sufficient", () => {
    const result = analyzeInventoryLow({
      alternative_locations: [],
      available_quantity: 12,
      inventory_item_id: "iitem_1",
      location_id: "loc_hcm",
      required_quantity: 12,
    })

    expect(result.action_type).toBe("NO_ACTION")
    expect(result.terminal_status).toBe("RESOLVED")
    expect(result.risk_level).toBe("READ_ONLY")
  })
})
