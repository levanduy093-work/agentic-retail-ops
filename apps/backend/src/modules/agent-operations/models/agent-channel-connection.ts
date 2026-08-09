import { model } from "@medusajs/framework/utils"
import {
  CHANNEL_CONNECTION_STATUSES,
  CONVERSATION_CHANNELS,
} from "../types"

const AgentChannelConnection = model
  .define("agent_channel_connection", {
    id: model.id({ prefix: "agchan" }).primaryKey(),
    channel: model.enum([...CONVERSATION_CHANNELS]),
    status: model.enum([...CHANNEL_CONNECTION_STATUSES]).default("DISABLED"),
    tenant_id: model.text().default("default"),
    account_ref: model.text(),
    secret_ref: model.text().nullable(),
    config: model.json(),
  })
  .indexes([
    {
      name: "IDX_agent_channel_tenant_channel_account",
      on: ["tenant_id", "channel", "account_ref"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_channel_status",
      on: ["status"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentChannelConnection
