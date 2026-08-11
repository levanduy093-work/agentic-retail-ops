import { model } from "@medusajs/framework/utils"

const AgentKnowledgeSource = model
  .define("agent_knowledge_source", {
    id: model.id({ prefix: "agksrc" }).primaryKey(),
    name: model.text(),
    source_type: model
      .enum(["HTTPS_TEXT", "GOOGLE_DOC", "GOOGLE_SHEET", "GOOGLE_DRIVE"])
      .default("HTTPS_TEXT"),
    source_url: model.text(),
    status: model.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
    owner_id: model.text(),
    tenant_id: model.text().default("default"),
    scope: model.text().default("customer_support"),
    locale: model.text().default("vi"),
    last_sync_status: model
      .enum(["NEVER", "SUCCEEDED", "FAILED", "UNCHANGED"])
      .default("NEVER"),
    last_checked_at: model.dateTime().nullable(),
    last_synced_at: model.dateTime().nullable(),
    last_error: model.text().nullable(),
    last_etag: model.text().nullable(),
    last_checksum: model.text().nullable(),
    last_document_id: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_knowledge_source_unique",
      on: ["tenant_id", "source_url", "scope", "locale"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_knowledge_source_status",
      on: ["status", "last_sync_status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentKnowledgeSource
