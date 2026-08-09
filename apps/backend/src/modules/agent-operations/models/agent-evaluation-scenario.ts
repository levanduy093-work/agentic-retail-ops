import { model } from "@medusajs/framework/utils"
import { LIFECYCLE_STATUSES } from "../types"

const AgentEvaluationCase = model
  .define("agent_evaluation_scenario", {
    id: model.id({ prefix: "agevalsc" }).primaryKey(),
    scenario_key: model.text(),
    version: model.text(),
    agent_id: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    status: model.enum([...LIFECYCLE_STATUSES]).default("DRAFT"),
    initial_state: model.json(),
    event: model.json(),
    expected_assertions: model.json(),
    forbidden_assertions: model.json(),
    tags: model.json(),
  })
  .indexes([
    {
      name: "IDX_agent_eval_scenario_key_version",
      on: ["scenario_key", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_eval_scenario_agent_status",
      on: ["agent_id", "status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentEvaluationCase
