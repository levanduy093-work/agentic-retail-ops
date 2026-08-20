import { isCustomerSupportTaskOverdue } from "../customer-support-sla"

describe("customer support SLA policy", () => {
  const now = new Date("2026-08-20T12:00:00.000Z")

  it("escalates only an active, overdue support task once", () => {
    expect(
      isCustomerSupportTaskOverdue({
        due_at: "2026-08-20T11:59:59.000Z",
        escalated_at: null,
        now,
        status: "TODO",
        task_type: "SUPPORT_RESPONSE_REVIEW",
      })
    ).toBe(true)
    expect(
      isCustomerSupportTaskOverdue({
        due_at: "2026-08-20T11:59:59.000Z",
        escalated_at: "2026-08-20T11:59:59.500Z",
        now,
        status: "TODO",
        task_type: "SUPPORT_RESPONSE_REVIEW",
      })
    ).toBe(false)
  })

  it("does not escalate future, completed or unrelated tasks", () => {
    expect(
      isCustomerSupportTaskOverdue({
        due_at: "2026-08-20T12:01:00.000Z",
        escalated_at: null,
        now,
        status: "TODO",
        task_type: "SUPPORT_RESPONSE_REVIEW",
      })
    ).toBe(false)
    expect(
      isCustomerSupportTaskOverdue({
        due_at: "2026-08-20T11:59:59.000Z",
        escalated_at: null,
        now,
        status: "COMPLETED",
        task_type: "SUPPORT_RESPONSE_REVIEW",
      })
    ).toBe(false)
    expect(
      isCustomerSupportTaskOverdue({
        due_at: "2026-08-20T11:59:59.000Z",
        escalated_at: null,
        now,
        status: "TODO",
        task_type: "INVENTORY_REVIEW",
      })
    ).toBe(false)
  })
})
