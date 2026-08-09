import { model } from "@medusajs/framework/utils"
import { LIFECYCLE_STATUSES } from "../types"

const AgentPromptTemplate = model
  .define("agent_prompt_template", {
    id: model.id({ prefix: "agprompt" }).primaryKey(),
    prompt_key: model.text(),
    version: model.text(),
    agent_id: model.text(),
    status: model.enum([...LIFECYCLE_STATUSES]).default("DRAFT"),
    system_prompt: model.text(),
    input_schema: model.json(),
    output_schema: model.json(),
    max_tokens: model.number().default(1024),
    approved_by: model.text().nullable(),
    approved_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_prompt_key_version",
      on: ["prompt_key", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_prompt_agent_status",
      on: ["agent_id", "status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentPromptTemplate
