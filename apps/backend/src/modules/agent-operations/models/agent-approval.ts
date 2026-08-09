import { model } from "@medusajs/framework/utils"
import { APPROVAL_STATUSES } from "../types"

const AgentApproval = model
  .define("agent_approval", {
    id: model.id({ prefix: "agappr" }).primaryKey(),
    incident_id: model.text(),
    recommendation_id: model.text(),
    status: model.enum([...APPROVAL_STATUSES]).default("PENDING"),
    required_role: model.text(),
    policy_key: model.text(),
    policy_version: model.text(),
    requested_by_type: model.text(),
    requested_by_id: model.text(),
    requested_at: model.dateTime(),
    expires_at: model.dateTime(),
    decision_by_type: model.text().nullable(),
    decision_by_id: model.text().nullable(),
    decision_reason: model.text().nullable(),
    decided_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_approval_recommendation_id",
      on: ["recommendation_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_approval_status_expires_at",
      on: ["status", "expires_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_approval_incident_id",
      on: ["incident_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentApproval
