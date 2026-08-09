import { model } from "@medusajs/framework/utils"
import { AGENT_EVENT_STATUSES } from "../types"

const AgentEvent = model
  .define("agent_event", {
    id: model.id({ prefix: "agevt" }).primaryKey(),
    event_id: model.text(),
    event_type: model.text(),
    event_version: model.number().default(1),
    occurred_at: model.dateTime(),
    received_at: model.dateTime(),
    source: model.text(),
    tenant_id: model.text().default("default"),
    correlation_id: model.text(),
    causation_id: model.text().nullable(),
    subject_type: model.text(),
    subject_id: model.text(),
    payload: model.json(),
    status: model.enum([...AGENT_EVENT_STATUSES]).default("RECEIVED"),
    processed_at: model.dateTime().nullable(),
    last_error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_event_source_event_id",
      on: ["source", "event_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_event_status_received_at",
      on: ["status", "received_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_event_correlation_id",
      on: ["correlation_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentEvent
