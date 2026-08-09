import { model } from "@medusajs/framework/utils"
import { EVALUATION_RUN_STATUSES } from "../types"

const AgentEvaluationRun = model
  .define("agent_evaluation_run", {
    id: model.id({ prefix: "ageval" }).primaryKey(),
    scenario_id: model.text(),
    model_run_id: model.text().nullable(),
    status: model.enum([...EVALUATION_RUN_STATUSES]).default("RUNNING"),
    idempotency_key: model.text(),
    observed: model.json(),
    assertion_results: model.json(),
    score: model.number(),
    started_at: model.dateTime(),
    completed_at: model.dateTime().nullable(),
    error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_eval_run_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_eval_run_scenario_started_at",
      on: ["scenario_id", "started_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentEvaluationRun
