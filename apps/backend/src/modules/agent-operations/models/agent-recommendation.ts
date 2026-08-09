import { model } from "@medusajs/framework/utils"
import { RECOMMENDATION_STATUSES, RISK_LEVELS } from "../types"

const AgentRecommendation = model
  .define("agent_recommendation", {
    id: model.id({ prefix: "agrec" }).primaryKey(),
    incident_id: model.text(),
    run_id: model.text(),
    action_type: model.text(),
    risk_level: model.enum([...RISK_LEVELS]),
    status: model.enum([...RECOMMENDATION_STATUSES]).default("PROPOSED"),
    summary: model.text(),
    rationale: model.text(),
    evidence: model.json(),
    proposal: model.json(),
    expires_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_recommendation_incident_id",
      on: ["incident_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_recommendation_run_id",
      on: ["run_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AgentRecommendation
