import { model } from "@medusajs/framework/utils"
import {
  CONVERSATION_CHANNELS,
  CONVERSATION_STATUSES,
} from "../types"

const AgentConversation = model
  .define("agent_conversation", {
    id: model.id({ prefix: "agconv" }).primaryKey(),
    channel: model.enum([...CONVERSATION_CHANNELS]).default("IN_APP"),
    external_thread_id: model.text().nullable(),
    topic_type: model.text(),
    topic_id: model.text(),
    incident_id: model.text().nullable(),
    tenant_id: model.text().default("default"),
    title: model.text(),
    status: model.enum([...CONVERSATION_STATUSES]).default("OPEN"),
    opened_at: model.dateTime(),
    last_message_at: model.dateTime(),
    closed_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_conversation_channel_topic",
      on: ["channel", "topic_type", "topic_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_conversation_status_last_message_at",
      on: ["status", "last_message_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_conversation_incident_id",
      on: ["incident_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentConversation
