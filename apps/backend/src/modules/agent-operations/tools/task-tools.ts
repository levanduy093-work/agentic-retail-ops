import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

const TaskPriority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
const TaskStatus = z.enum([
  "TODO",
  "CLAIMED",
  "IN_PROGRESS",
  "WAITING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "DEAD",
])
const AssigneeType = z.enum(["agent", "team", "user"])

export const TaskCreateInput = z.strictObject({
  description: z.string().trim().max(4_000).optional(),
  due_at: z.string().datetime().optional(),
  incident_id: z.string().trim().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  priority: TaskPriority,
  task_type: z.string().trim().min(1).max(100),
  tenant_id: z.string().trim().min(1).default("default"),
  title: z.string().trim().min(1).max(500),
})

export const TaskAssignInput = z.strictObject({
  assigned_to_id: z.string().trim().min(1),
  assigned_to_type: AssigneeType,
  expected_status: z.enum(["TODO", "CLAIMED"]).default("TODO"),
  task_id: z.string().trim().min(1),
})

export const TaskEscalateInput = z.strictObject({
  assigned_to_id: z.string().trim().min(1),
  assigned_to_type: z.enum(["team", "user"]),
  expected_status: z.enum([
    "TODO",
    "CLAIMED",
    "IN_PROGRESS",
    "WAITING",
    "FAILED",
  ]),
  priority: z.enum(["HIGH", "CRITICAL"]).default("CRITICAL"),
  reason: z.string().trim().min(3).max(4_000),
  task_id: z.string().trim().min(1),
})

export const GovernedTaskSnapshot = z.strictObject({
  assigned_to_id: z.string().nullable(),
  assigned_to_type: z.string().nullable(),
  escalation_reason: z.string().nullable(),
  escalated_at: z.string().datetime().nullable(),
  escalated_by_id: z.string().nullable(),
  incident_id: z.string().nullable(),
  priority: TaskPriority,
  status: TaskStatus,
  task_id: z.string().min(1),
  title: z.string().min(1),
})

export const TaskCommandOutput = z.discriminatedUnion("outcome", [
  z.strictObject({
    duplicate: z.boolean(),
    outcome: z.literal("SUCCEEDED"),
    task: GovernedTaskSnapshot,
  }),
  z.strictObject({
    code: z.enum(["TASK_STATE_CONFLICT", "TASK_TERMINAL"]),
    message: z.string().min(1),
    outcome: z.literal("CONFLICT"),
    task: GovernedTaskSnapshot,
  }),
])

export type TaskCreateInput = z.infer<typeof TaskCreateInput>
export type TaskAssignInput = z.infer<typeof TaskAssignInput>
export type TaskEscalateInput = z.infer<typeof TaskEscalateInput>
export type TaskCommandOutput = z.infer<typeof TaskCommandOutput>

export const TASK_CREATE_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "task_id",
    "incident_id",
    "task_type",
    "priority",
    "due_at",
  ],
  description: "Create an idempotent governed operational task.",
  error_codes: [
    "ACTION_GATE_REJECTED",
    "INVALID_TOOL_INPUT",
    "TASK_CREATE_FAILED",
  ],
  idempotency: "REQUIRED",
  input_schema: TaskCreateInput,
  kind: "COMMAND",
  name: "task.create",
  output_schema: TaskCommandOutput,
  permission: "agent_task:create",
  required_role: null,
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 1_000,
    max_attempts: 3,
    max_delay_ms: 60_000,
  },
  risk_level: "LOW",
  timeout_ms: 10_000,
  version: "1.0.0",
})

export const TASK_ASSIGN_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "task_id",
    "expected_status",
    "assigned_to_type",
    "assigned_to_id",
  ],
  description: "Assign or re-affirm ownership of an operational task.",
  error_codes: [
    "ACTION_GATE_REJECTED",
    "INVALID_TOOL_INPUT",
    "TASK_STATE_CONFLICT",
  ],
  idempotency: "REQUIRED",
  input_schema: TaskAssignInput,
  kind: "COMMAND",
  name: "task.assign",
  output_schema: TaskCommandOutput,
  permission: "agent_task:update",
  required_role: null,
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 1_000,
    max_attempts: 3,
    max_delay_ms: 60_000,
  },
  risk_level: "MEDIUM",
  timeout_ms: 10_000,
  version: "1.0.0",
})

export const TASK_ESCALATE_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "task_id",
    "expected_status",
    "priority",
    "assigned_to_type",
    "assigned_to_id",
    "reason",
  ],
  description:
    "Escalate a non-terminal task to a named human or operations team.",
  error_codes: [
    "ACTION_GATE_REJECTED",
    "INVALID_TOOL_INPUT",
    "TASK_STATE_CONFLICT",
  ],
  idempotency: "REQUIRED",
  input_schema: TaskEscalateInput,
  kind: "COMMAND",
  name: "task.escalate",
  output_schema: TaskCommandOutput,
  permission: "agent_task:update",
  required_role: null,
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 1_000,
    max_attempts: 3,
    max_delay_ms: 60_000,
  },
  risk_level: "MEDIUM",
  timeout_ms: 10_000,
  version: "1.0.0",
})

export function toGovernedTaskSnapshot(task: {
  assigned_to_id?: string | null
  assigned_to_type?: string | null
  escalation_reason?: string | null
  escalated_at?: Date | string | null
  escalated_by_id?: string | null
  id: string
  incident_id?: string | null
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  status:
    | "TODO"
    | "CLAIMED"
    | "IN_PROGRESS"
    | "WAITING"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED"
    | "DEAD"
  title: string
}) {
  return {
    assigned_to_id: task.assigned_to_id ?? null,
    assigned_to_type: task.assigned_to_type ?? null,
    escalation_reason: task.escalation_reason ?? null,
    escalated_at: task.escalated_at
      ? new Date(task.escalated_at).toISOString()
      : null,
    escalated_by_id: task.escalated_by_id ?? null,
    incident_id: task.incident_id ?? null,
    priority: task.priority,
    status: task.status,
    task_id: task.id,
    title: task.title,
  }
}
