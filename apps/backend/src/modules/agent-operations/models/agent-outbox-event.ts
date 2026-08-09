import { model } from "@medusajs/framework/utils"
import { OUTBOX_STATUSES } from "../types"

const AgentOutboxEvent = model
  .define("agent_outbox_event", {
    id: model.id({ prefix: "agout" }).primaryKey(),
    aggregate_type: model.text(),
    aggregate_id: model.text(),
    event_type: model.text(),
    event_version: model.number().default(1),
    payload: model.json(),
    status: model.enum([...OUTBOX_STATUSES]).default("PENDING"),
    idempotency_key: model.text(),
    attempt_count: model.number().default(0),
    available_at: model.dateTime(),
    locked_by: model.text().nullable(),
    locked_at: model.dateTime().nullable(),
    lock_expires_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
    last_error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agent_outbox_idempotency_key",
      on: ["idempotency_key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_outbox_status_available_at",
      on: ["status", "available_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentOutboxEvent
