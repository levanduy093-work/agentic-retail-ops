import { model } from "@medusajs/framework/utils"

const AgentAiProviderCredential = model
  .define("agent_ai_provider_credential", {
    id: model.id({ prefix: "agaicred" }).primaryKey(),
    provider: model.enum(["OPENAI", "GEMINI"]),
    tenant_id: model.text().default("default"),
    encrypted_secret: model.text(),
    encryption_iv: model.text(),
    encryption_tag: model.text(),
    key_version: model.text().default("v1"),
    secret_hint: model.text(),
    embedding_enabled: model.boolean().default(false),
    embedding_model: model.text(),
    embedding_dimensions: model.number().nullable(),
    generation_enabled: model.boolean().default(false),
    generation_model: model.text(),
    updated_by_id: model.text(),
  })
  .indexes([
    {
      name: "IDX_agent_ai_provider_credential_unique",
      on: ["tenant_id", "provider"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AgentAiProviderCredential
