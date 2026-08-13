import { model } from "@medusajs/framework/utils"

const AgentConversationMemory = model
  .define("agent_conversation_memory", {
    id: model.id({ prefix: "agmem" }).primaryKey(),
    conversation_id: model.text(),
    tenant_id: model.text().default("default"),
    summary: model.text(),
    customer_facts: model.json(),
    open_questions: model.json(),
    resolved_topics: model.json(),
    last_message_id: model.text(),
    source_message_count: model.number().default(0),
    version: model.number().default(1),
    summarized_at: model.dateTime(),
  })
  .indexes([
    {
      name: "IDX_agent_conversation_memory_conversation_unique",
      on: ["conversation_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_conversation_memory_tenant_updated",
      on: ["tenant_id", "summarized_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentConversationMemory
