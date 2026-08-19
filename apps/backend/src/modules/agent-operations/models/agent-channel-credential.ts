import { model } from "@medusajs/framework/utils"
import { CONVERSATION_CHANNELS } from "../types"

const AgentChannelCredential = model
  .define("agent_channel_credential", {
    id: model.id({ prefix: "agchancred" }).primaryKey(),
    channel: model.enum([...CONVERSATION_CHANNELS]),
    tenant_id: model.text().default("default"),
    account_ref: model.text().default("primary"),
    encrypted_secret: model.text(),
    encryption_iv: model.text(),
    encryption_tag: model.text(),
    key_version: model.text().default("v1"),
    secret_hint: model.text(),
    encrypted_webhook_secret: model.text().nullable(),
    webhook_secret_iv: model.text().nullable(),
    webhook_secret_tag: model.text().nullable(),
    public_base_url: model.text().nullable(),
    updated_by_id: model.text().default("system"),
  })
  .indexes([
    {
      name: "IDX_agent_channel_credential_unique",
      on: ["tenant_id", "channel", "account_ref"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default AgentChannelCredential
