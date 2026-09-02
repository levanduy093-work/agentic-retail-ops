import { model } from "@medusajs/framework/utils"
import { LIFECYCLE_STATUSES, SKILL_OWNERS } from "../types"

const AgentSkillDefinition = model
  .define("agent_skill_definition", {
    id: model.id({ prefix: "agskill" }).primaryKey(),
    key: model.text(),
    version: model.text(),
    tenant_id: model.text().nullable(),
    owner: model.enum([...SKILL_OWNERS]).default("PLATFORM"),
    name: model.text(),
    description: model.text(),
    instructions: model.text(),
    status: model.enum([...LIFECYCLE_STATUSES]).default("DRAFT"),
    configuration_schema: model.json(),
    eligible_tool_names: model.json(),
    required_evidence: model.json(),
    evaluation_scenario_keys: model.json(),
  })
  .indexes([
    {
      name: "IDX_agent_skill_definition_key_version_tenant",
      on: ["key", "version", "tenant_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_skill_definition_owner_status",
      on: ["owner", "status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentSkillDefinition
