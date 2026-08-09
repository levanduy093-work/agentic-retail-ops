import { model } from "@medusajs/framework/utils"

const AgentAuditEvent = model
  .define("agent_audit_event", {
    id: model.id({ prefix: "agaud" }).primaryKey(),
    incident_id: model.text().nullable(),
    run_id: model.text().nullable(),
    event_type: model.text(),
    actor_type: model.text(),
    actor_id: model.text(),
    action: model.text(),
    resource_type: model.text(),
    resource_id: model.text(),
    correlation_id: model.text(),
    data: model.json().nullable(),
    recorded_at: model.dateTime(),
  })
  .indexes([
    {
      name: "IDX_agent_audit_incident_id_recorded_at",
      on: ["incident_id", "recorded_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_audit_correlation_id",
      on: ["correlation_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentAuditEvent
