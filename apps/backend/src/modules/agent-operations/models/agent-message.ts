import { model } from "@medusajs/framework/utils"
import {
  CONVERSATION_CHANNELS,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
} from "../types"

const AgentMessage = model
  .define("agent_message", {
    id: model.id({ prefix: "agmsg" }).primaryKey(),
    conversation_id: model.text(),
    channel: model.enum([...CONVERSATION_CHANNELS]).default("IN_APP"),
    direction: model.enum([...MESSAGE_DIRECTIONS]),
    message_type: model.enum([...MESSAGE_TYPES]),
    status: model.enum([...MESSAGE_STATUSES]),
    sender_type: model.text(),
    sender_id: model.text(),
    body: model.text(),
    structured_content: model.json().nullable(),
    command_name: model.text().nullable(),
    idempotency_key: model.text(),
    external_message_id: model.text().nullable(),
    occurred_at: model.dateTime(),
    processed_at: model.dateTime().nullable(),
    error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_message_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_message_conversation_occurred_at",
      on: ["conversation_id", "occurred_at"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_message_status_occurred_at",
      on: ["status", "occurred_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentMessage
