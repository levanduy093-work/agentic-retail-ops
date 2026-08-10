import {
  APPROVAL_DECIDE_TOOL,
  INCIDENT_CREATE_TOOL,
  KNOWLEDGE_PROPOSE_TOOL,
  MESSAGE_SEND_TOOL,
} from "../tools/platform-command-tools"

describe("platform command tool contracts", () => {
  test("requires canonical event grounding for incident creation", () => {
    expect(() =>
      INCIDENT_CREATE_TOOL.input_schema.parse({
        incident_type: "inventory-risk",
        priority: "HIGH",
        subject_id: "item_1",
        subject_type: "inventory_item",
        title: "Inventory risk",
      })
    ).toThrow()
  })

  test("keeps knowledge proposals in draft and approval decisions human-gated", () => {
    expect(KNOWLEDGE_PROPOSE_TOOL.name).toBe("knowledge.propose")
    expect(KNOWLEDGE_PROPOSE_TOOL.approval_required).toBe(false)
    expect(APPROVAL_DECIDE_TOOL.required_role).toBe("operations_manager")
    expect(APPROVAL_DECIDE_TOOL.risk_level).toBe("HIGH")
  })

  test("only allows outbound text or notification messages", () => {
    expect(() =>
      MESSAGE_SEND_TOOL.input_schema.parse({
        body: "Approval required",
        conversation_id: "agconv_1",
        message_type: "COMMAND",
      })
    ).toThrow()
  })
})
