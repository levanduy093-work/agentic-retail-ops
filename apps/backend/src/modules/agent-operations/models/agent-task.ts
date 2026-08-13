import { model } from "@medusajs/framework/utils"
import { AGENT_TASK_STATUSES } from "../types"

const AgentTask = model
  .define("agent_task", {
    id: model.id({ prefix: "agtask" }).primaryKey(),
    incident_id: model.text().nullable(),
    conversation_id: model.text().nullable(),
    task_type: model.text(),
    title: model.text(),
    description: model.text().nullable(),
    priority: model.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    status: model.enum([...AGENT_TASK_STATUSES]).default("TODO"),
    tenant_id: model.text().default("default"),
    assigned_to_type: model.text().nullable(),
    assigned_to_id: model.text().nullable(),
    created_by_type: model.text(),
    created_by_id: model.text(),
    idempotency_key: model.text(),
    input: model.json().nullable(),
    result: model.json().nullable(),
    due_at: model.dateTime().nullable(),
    claimed_at: model.dateTime().nullable(),
    started_at: model.dateTime().nullable(),
    completed_at: model.dateTime().nullable(),
    failure: model.text().nullable(),
    escalation_reason: model.text().nullable(),
    escalated_at: model.dateTime().nullable(),
    escalated_by_id: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_task_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_task_status_priority_due_at",
      on: ["status", "priority", "due_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_task_incident_id",
      on: ["incident_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_task_conversation_status",
      on: ["conversation_id", "status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentTask
