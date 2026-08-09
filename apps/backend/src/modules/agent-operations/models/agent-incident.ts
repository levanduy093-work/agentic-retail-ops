import { model } from "@medusajs/framework/utils"
import { INCIDENT_STATUSES } from "../types"

const AgentIncident = model
  .define("agent_incident", {
    id: model.id({ prefix: "aginc" }).primaryKey(),
    trigger_event_id: model.text(),
    incident_type: model.text(),
    title: model.text(),
    summary: model.text().nullable(),
    priority: model.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    status: model.enum([...INCIDENT_STATUSES]).default("RECEIVED"),
    tenant_id: model.text().default("default"),
    correlation_id: model.text(),
    subject_type: model.text(),
    subject_id: model.text(),
    owner_id: model.text().nullable(),
    context: model.json().nullable(),
    resolution: model.json().nullable(),
    resolved_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_incident_trigger_event_id",
      on: ["trigger_event_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_incident_status_priority",
      on: ["status", "priority"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_incident_correlation_id",
      on: ["correlation_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentIncident
