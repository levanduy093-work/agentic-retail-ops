import { isTaskOverdueForEscalation } from "../supervisor-policy"

describe("agent supervisor policy", () => {
  const now = new Date("2026-08-10T12:00:00.000Z")

  test("selects overdue active tasks", () => {
    expect(
      isTaskOverdueForEscalation(
        {
          due_at: "2026-08-10T11:59:00.000Z",
          priority: "HIGH",
          status: "IN_PROGRESS",
        },
        now
      )
    ).toBe(true)
  })

  test("ignores future, terminal, and already escalated tasks", () => {
    expect(
      isTaskOverdueForEscalation(
        {
          due_at: "2026-08-10T12:01:00.000Z",
          priority: "HIGH",
          status: "TODO",
        },
        now
      )
    ).toBe(false)
    expect(
      isTaskOverdueForEscalation(
        {
          due_at: "2026-08-10T11:00:00.000Z",
          priority: "HIGH",
          status: "COMPLETED",
        },
        now
      )
    ).toBe(false)
    expect(
      isTaskOverdueForEscalation(
        {
          assigned_to_id: "team_operations_manager",
          assigned_to_type: "team",
          due_at: "2026-08-10T11:00:00.000Z",
          priority: "CRITICAL",
          status: "WAITING",
        },
        now
      )
    ).toBe(false)
  })
})
