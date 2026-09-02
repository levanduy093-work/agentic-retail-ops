import { model } from "@medusajs/framework/utils"
import { TENANT_SKILL_STATUSES } from "../types"

const AgentTenantSkill = model
  .define("agent_tenant_skill", {
    id: model.id({ prefix: "agtskill" }).primaryKey(),
    tenant_id: model.text(),
    skill_key: model.text(),
    skill_version: model.text(),
    definition_id: model.text().nullable(),
    status: model.enum([...TENANT_SKILL_STATUSES]).default("DRAFT"),
    configuration: model.json(),
    enabled_tool_names: model.json(),
    installed_by: model.text(),
    activated_by: model.text().nullable(),
    activated_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_tenant_skill_key_version",
      on: ["tenant_id", "skill_key", "skill_version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_tenant_skill_tenant_status",
      on: ["tenant_id", "status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentTenantSkill
