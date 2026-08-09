import { model } from "@medusajs/framework/utils"
import { MODEL_RUN_STATUSES } from "../types"

const AgentModelRun = model
  .define("agent_model_run", {
    id: model.id({ prefix: "agmodel" }).primaryKey(),
    incident_id: model.text().nullable(),
    run_id: model.text().nullable(),
    agent_id: model.text(),
    agent_version: model.text(),
    provider: model.text(),
    model: model.text(),
    prompt_key: model.text(),
    prompt_version: model.text(),
    status: model.enum([...MODEL_RUN_STATUSES]).default("PENDING"),
    idempotency_key: model.text(),
    input: model.json(),
    output: model.json().nullable(),
    input_tokens: model.number().nullable(),
    output_tokens: model.number().nullable(),
    cost_micros: model.number().nullable(),
    latency_ms: model.number().nullable(),
    redacted: model.boolean().default(true),
    started_at: model.dateTime().nullable(),
    completed_at: model.dateTime().nullable(),
    error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_model_run_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_model_run_agent_status",
      on: ["agent_id", "status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentModelRun
