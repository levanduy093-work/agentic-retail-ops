import { model } from "@medusajs/framework/utils"
import { TOOL_CALL_KINDS, TOOL_CALL_STATUSES } from "../types"

const AgentToolCall = model
  .define("agent_tool_call", {
    id: model.id({ prefix: "agtcall" }).primaryKey(),
    action_request_id: model.text(),
    incident_id: model.text().nullable(),
    tool_name: model.text(),
    tool_version: model.text(),
    kind: model.enum([...TOOL_CALL_KINDS]),
    status: model.enum([...TOOL_CALL_STATUSES]).default("RUNNING"),
    idempotency_key: model.text(),
    input: model.json(),
    output: model.json().nullable(),
    error: model.text().nullable(),
    started_at: model.dateTime(),
    completed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_tool_call_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_tool_call_action_request_id",
      on: ["action_request_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_tool_call_incident_id_started_at",
      on: ["incident_id", "started_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentToolCall
