import {
  TaskAssignInput,
  TaskCommandOutput,
  TaskCreateInput,
  TaskEscalateInput,
  toGovernedTaskSnapshot,
} from "../tools/task-tools"

describe("task command tools", () => {
  test("applies safe defaults to task creation", () => {
    expect(
      TaskCreateInput.parse({
        priority: "HIGH",
        task_type: "HUMAN_REVIEW",
        title: "Review delayed shipment",
      })
    ).toEqual({
      priority: "HIGH",
      task_type: "HUMAN_REVIEW",
      tenant_id: "default",
      title: "Review delayed shipment",
    })
  })

  test("limits assignment and escalation targets", () => {
    expect(
      TaskAssignInput.parse({
        assigned_to_id: "agent_worker",
        assigned_to_type: "agent",
        task_id: "agtask_1",
      })
    ).toMatchObject({ expected_status: "TODO" })
    expect(() =>
      TaskEscalateInput.parse({
        assigned_to_id: "agent_worker",
        assigned_to_type: "agent",
        expected_status: "IN_PROGRESS",
        reason: "SLA exceeded",
        task_id: "agtask_1",
      })
    ).toThrow()
  })

  test("normalizes persisted task dates for tool output", () => {
    expect(
      toGovernedTaskSnapshot({
        assigned_to_id: "team_ops",
        assigned_to_type: "team",
        escalated_at: new Date("2026-08-10T07:00:00.000Z"),
        escalated_by_id: "agent_coordinator",
        escalation_reason: "SLA exceeded",
        id: "agtask_1",
        incident_id: null,
        priority: "CRITICAL",
        status: "IN_PROGRESS",
        title: "Review delayed shipment",
      })
    ).toMatchObject({
      escalated_at: "2026-08-10T07:00:00.000Z",
      priority: "CRITICAL",
      task_id: "agtask_1",
    })
  })

  test("accepts explicit safe conflicts as command output", () => {
    expect(
      TaskCommandOutput.parse({
        code: "TASK_STATE_CONFLICT",
        message: "Task is already completed.",
        outcome: "CONFLICT",
        task: {
          assigned_to_id: null,
          assigned_to_type: null,
          escalation_reason: null,
          escalated_at: null,
          escalated_by_id: null,
          incident_id: null,
          priority: "HIGH",
          status: "COMPLETED",
          task_id: "agtask_1",
          title: "Review delayed shipment",
        },
      })
    ).toMatchObject({ outcome: "CONFLICT" })
  })
})
