import {
  AdminDecideAgentApproval,
  AdminIngestInventoryLowEvent,
  AdminSendAgentConversationMessage,
} from "../../../api/admin/agent-operations/validators"

describe("agent operations API validators", () => {
  test("accepts a complete inventory.low event", () => {
    const result = AdminIngestInventoryLowEvent.safeParse({
      correlation_id: "correlation-1",
      event_id: "event-1",
      event_type: "inventory.low",
      event_version: 1,
      occurred_at: "2026-08-10T00:00:00.000Z",
      payload: {
        alternative_locations: [],
        available_quantity: 2,
        inventory_item_id: "inventory-item-1",
        location_id: "warehouse-hcm",
        required_quantity: 10,
        sku: "SKU-1",
      },
      source: "inventory-service",
      subject_id: "inventory-item-1",
      subject_type: "inventory_item",
    })

    expect(result.success).toBe(true)
  })

  test("rejects an event with a negative quantity", () => {
    const result = AdminIngestInventoryLowEvent.safeParse({
      correlation_id: "correlation-1",
      event_id: "event-1",
      event_type: "inventory.low",
      event_version: 1,
      occurred_at: "2026-08-10T00:00:00.000Z",
      payload: {
        alternative_locations: [],
        available_quantity: -1,
        inventory_item_id: "inventory-item-1",
        location_id: "warehouse-hcm",
        required_quantity: 10,
        sku: "SKU-1",
      },
      source: "inventory-service",
      subject_id: "inventory-item-1",
      subject_type: "inventory_item",
    })

    expect(result.success).toBe(false)
  })

  test("requires a reason for an approval decision", () => {
    const result = AdminDecideAgentApproval.safeParse({
      decision: "APPROVED",
      reason: "",
    })

    expect(result.success).toBe(false)
  })

  test("accepts a structured approval chat command", () => {
    const result = AdminSendAgentConversationMessage.safeParse({
      body: "Duyệt đề xuất chuyển kho",
      client_message_id: "mobile-message-1",
      command: {
        approval_id: "agappr_01",
        decision: "APPROVED",
        name: "APPROVAL_DECISION",
        reason: "Kho đích cần bổ sung hàng",
      },
      message_type: "COMMAND",
    })

    expect(result.success).toBe(true)
  })

  test("rejects unknown fields in a structured chat command", () => {
    const result = AdminSendAgentConversationMessage.safeParse({
      body: "Duyệt đề xuất chuyển kho",
      client_message_id: "mobile-message-1",
      command: {
        approval_id: "agappr_01",
        decision: "APPROVED",
        name: "APPROVAL_DECISION",
        reason: "Kho đích cần bổ sung hàng",
        tool_name: "inventory.execute-transfer",
      },
      message_type: "COMMAND",
    })

    expect(result.success).toBe(false)
  })
})
