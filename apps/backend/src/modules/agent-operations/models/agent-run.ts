import { model } from "@medusajs/framework/utils"
import { AGENT_RUN_STATUSES } from "../types"

const AgentRun = model
  .define("agent_run", {
    id: model.id({ prefix: "agrun" }).primaryKey(),
    incident_id: model.text(),
    trigger_event_id: model.text(),
    agent_id: model.text(),
    agent_version: model.text(),
    status: model.enum([...AGENT_RUN_STATUSES]).default("RECEIVED"),
    input: model.json(),
    output: model.json().nullable(),
    started_at: model.dateTime(),
    completed_at: model.dateTime().nullable(),
    error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_run_incident_id",
      on: ["incident_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_run_trigger_event_id_agent_id",
      on: ["trigger_event_id", "agent_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AgentRun
