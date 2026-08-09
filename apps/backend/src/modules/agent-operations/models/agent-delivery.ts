import { model } from "@medusajs/framework/utils"
import { CONVERSATION_CHANNELS, DELIVERY_STATUSES } from "../types"

const AgentDelivery = model
  .define("agent_delivery", {
    id: model.id({ prefix: "agdel" }).primaryKey(),
    message_id: model.text(),
    connection_id: model.text(),
    channel: model.enum([...CONVERSATION_CHANNELS]),
    status: model.enum([...DELIVERY_STATUSES]).default("PENDING"),
    idempotency_key: model.text(),
    attempt_count: model.number().default(0),
    available_at: model.dateTime(),
    locked_by: model.text().nullable(),
    locked_at: model.dateTime().nullable(),
    lock_expires_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
    external_message_id: model.text().nullable(),
    last_error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_delivery_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_delivery_status_available_at",
      on: ["status", "available_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentDelivery
