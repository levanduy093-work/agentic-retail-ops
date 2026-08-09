import { model } from "@medusajs/framework/utils"
import { LIFECYCLE_STATUSES, RISK_LEVELS } from "../types"

const AgentPolicyDefinition = model
  .define("agent_policy_definition", {
    id: model.id({ prefix: "agpol" }).primaryKey(),
    policy_key: model.text(),
    version: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    status: model.enum([...LIFECYCLE_STATUSES]).default("DRAFT"),
    action_type: model.text(),
    risk_level: model.enum([...RISK_LEVELS]),
    requires_approval: model.boolean().default(false),
    required_role: model.text().nullable(),
    conditions: model.json(),
    tenant_id: model.text().default("default"),
    effective_at: model.dateTime(),
    expires_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_policy_key_version",
      on: ["policy_key", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_policy_action_status",
      on: ["action_type", "status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentPolicyDefinition
