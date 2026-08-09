import { model } from "@medusajs/framework/utils"
import { KNOWLEDGE_STATUSES } from "../types"

const AgentKnowledgeDocument = model
  .define("agent_knowledge_document", {
    id: model.id({ prefix: "agknow" }).primaryKey(),
    document_key: model.text(),
    version: model.text(),
    title: model.text(),
    content: model.text(),
    checksum: model.text(),
    status: model.enum([...KNOWLEDGE_STATUSES]).default("DRAFT"),
    owner_id: model.text(),
    tenant_id: model.text().default("default"),
    scope: model.text().default("operations"),
    locale: model.text().default("vi"),
    citation_locator: model.text(),
    effective_at: model.dateTime(),
    expires_at: model.dateTime().nullable(),
    approved_by: model.text().nullable(),
    approved_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_knowledge_key_version",
      on: ["document_key", "version"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_knowledge_status_effective_at",
      on: ["status", "effective_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentKnowledgeDocument
