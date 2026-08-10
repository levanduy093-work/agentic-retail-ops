import { model } from "@medusajs/framework/utils"
import { ACTION_REQUEST_STATUSES, RISK_LEVELS } from "../types"

const AgentActionRequest = model
  .define("agent_action_request", {
    id: model.id({ prefix: "agact" }).primaryKey(),
    incident_id: model.text().nullable(),
    recommendation_id: model.text().nullable(),
    approval_id: model.text().nullable(),
    correlation_id: model.text(),
    tenant_id: model.text().default("default"),
    action_type: model.text(),
    tool_name: model.text(),
    tool_version: model.text(),
    permission: model.text(),
    policy_key: model.text(),
    policy_version: model.text(),
    risk_level: model.enum([...RISK_LEVELS]),
    status: model.enum([...ACTION_REQUEST_STATUSES]).default("PENDING"),
    idempotency_key: model.text(),
    input: model.json(),
    result: model.json().nullable(),
    requested_by_type: model.text(),
    requested_by_id: model.text(),
    requested_at: model.dateTime(),
    available_at: model.dateTime(),
    attempt_count: model.number().default(0),
    locked_by: model.text().nullable(),
    locked_at: model.dateTime().nullable(),
    lock_expires_at: model.dateTime().nullable(),
    completed_at: model.dateTime().nullable(),
    last_error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_action_request_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_action_request_status_available_at",
      on: ["status", "available_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_action_request_incident_id",
      on: ["incident_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_action_request_correlation_id",
      on: ["correlation_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_action_request_approval_id",
      on: ["approval_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AgentActionRequest
