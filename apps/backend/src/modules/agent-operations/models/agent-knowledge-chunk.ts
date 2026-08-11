import { model } from "@medusajs/framework/utils"

const AgentKnowledgeChunk = model
  .define("agent_knowledge_chunk", {
    id: model.id({ prefix: "agkchunk" }).primaryKey(),
    document_id: model.text(),
    chunk_index: model.number(),
    content: model.text(),
    checksum: model.text(),
    citation_locator: model.text(),
    word_count: model.number(),
  })
  .indexes([
    {
      name: "IDX_agent_knowledge_chunk_document_index",
      on: ["document_id", "chunk_index"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_knowledge_chunk_document_id",
      on: ["document_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentKnowledgeChunk
