import { model } from "@medusajs/framework/utils"

const AgentConnectorCredential = model
  .define("agent_connector_credential", {
    id: model.id({ prefix: "agcred" }).primaryKey(),
    connector_type: model.enum(["GOOGLE_DRIVE"]),
    tenant_id: model.text().default("default"),
    account_email: model.text(),
    encrypted_secret: model.text(),
    encryption_iv: model.text(),
    encryption_tag: model.text(),
    key_version: model.text().default("v1"),
    scopes: model.json(),
    updated_by_id: model.text(),
  })
  .indexes([
    {
      name: "IDX_agent_connector_credential_unique",
      on: ["tenant_id", "connector_type"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AgentConnectorCredential
