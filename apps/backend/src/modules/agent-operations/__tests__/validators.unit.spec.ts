import {
  AdminDecideAgentApproval,
  AdminIngestInventoryLowEvent,
  AdminIngestOrderExceptionEvent,
  AdminRequestAgentAction,
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

  test("accepts a bounded order.exception event", () => {
    const result = AdminIngestOrderExceptionEvent.safeParse({
      correlation_id: "order-42-exception",
      event_id: "exception-42",
      event_type: "order.exception",
      event_version: 1,
      occurred_at: "2026-08-10T00:15:00.000Z",
      payload: {
        detected_at: "2026-08-10T00:15:00.000Z",
        exception_type: "PAYMENT_STUCK",
        order_id: "order_42",
      },
      source: "order-monitor",
      subject_id: "order_42",
      subject_type: "order",
    })

    expect(result.success).toBe(true)
  })

  test("rejects an order exception whose subject does not match", () => {
    const result = AdminIngestOrderExceptionEvent.safeParse({
      correlation_id: "order-42-exception",
      event_id: "exception-42",
      event_type: "order.exception",
      event_version: 1,
      occurred_at: "2026-08-10T00:15:00.000Z",
      payload: {
        detected_at: "2026-08-10T00:15:00.000Z",
        exception_type: "PAYMENT_STUCK",
        order_id: "order_42",
      },
      source: "order-monitor",
      subject_id: "order_99",
      subject_type: "order",
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

  test("accepts an action request without trusting client permissions", () => {
    expect(
      AdminRequestAgentAction.safeParse({
        correlation_id: "corr-1",
        idempotency_key: "admin:knowledge:1",
        input: { document_key: "returns-policy" },
        tool_name: "knowledge.propose",
        tool_version: "1.0.0",
      }).success
    ).toBe(true)

    expect(
      AdminRequestAgentAction.safeParse({
        correlation_id: "corr-1",
        granted_permissions: ["agent_inventory:transfer"],
        idempotency_key: "admin:knowledge:1",
        input: {},
        tool_name: "knowledge.propose",
        tool_version: "1.0.0",
      }).success
    ).toBe(false)
  })
})
