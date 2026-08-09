import {
  buildApprovalDecisionResultMessage,
  buildApprovalRequestedMessage,
  isApprovalDecisionCommandTarget,
} from "../communication"

describe("agent communication messages", () => {
  it("builds an actionable approval notification", () => {
    const result = buildApprovalRequestedMessage({
      approval: {
        expires_at: "2026-08-11T00:00:00.000Z",
        id: "agappr_01",
        required_role: "operations_manager",
      },
      incident: {
        id: "aginc_01",
        priority: "HIGH",
        title: "Inventory risk for inventory_01",
      },
      recommendation: {
        id: "agrec_01",
        summary: "Transfer 10 units from HN to HCM",
      },
    })

    expect(result.structured_content).toMatchObject({
      approval_id: "agappr_01",
      available_commands: ["APPROVAL_DECISION"],
      incident_id: "aginc_01",
      priority: "HIGH",
    })
    expect(result.body).toContain("operations_manager")
  })

  it("explains an idempotent approval command result", () => {
    const result = buildApprovalDecisionResultMessage({
      action_request_id: "agact_01",
      approval_id: "agappr_01",
      decision: "APPROVED",
      duplicate: true,
    })

    expect(result.structured_content).toEqual({
      action_request_id: "agact_01",
      approval_id: "agappr_01",
      decision: "APPROVED",
      duplicate: true,
    })
    expect(result.body).toContain("không tạo tác vụ mới")
  })

  it("rejects a command aimed at another approval conversation", () => {
    expect(
      isApprovalDecisionCommandTarget(
        { topic_id: "agappr_01", topic_type: "APPROVAL" },
        { approval_id: "agappr_02" }
      )
    ).toBe(false)
    expect(
      isApprovalDecisionCommandTarget(
        { topic_id: "agappr_01", topic_type: "APPROVAL" },
        { approval_id: "agappr_01" }
      )
    ).toBe(true)
  })
})
