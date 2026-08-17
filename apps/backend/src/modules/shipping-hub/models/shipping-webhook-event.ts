import { model } from "@medusajs/framework/utils"

const ShippingWebhookEvent = model
  .define("shipping_webhook_event", {
    id: model.id({ prefix: "shwe" }).primaryKey(),
    carrier_code: model.text(),
    external_event_id: model.text(),
    tracking_number: model.text().nullable(),
    status: model
      .enum(["RECEIVED", "PROCESSED", "IGNORED", "FAILED"])
      .default("RECEIVED"),
    payload: model.json(),
    occurred_at: model.dateTime().nullable(),
    received_at: model.dateTime(),
    processed_at: model.dateTime().nullable(),
    last_error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_shipping_webhook_event_carrier_external_id",
      on: ["carrier_code", "external_event_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_shipping_webhook_event_tracking_number",
      on: ["carrier_code", "tracking_number"],
      where: "deleted_at IS NULL",
    },
  ])

export default ShippingWebhookEvent
