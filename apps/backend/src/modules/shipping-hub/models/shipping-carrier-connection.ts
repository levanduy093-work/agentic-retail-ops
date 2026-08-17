import { model } from "@medusajs/framework/utils"

const ShippingCarrierConnection = model
  .define("shipping_carrier_connection", {
    id: model.id({ prefix: "shpc" }).primaryKey(),
    code: model.text(),
    name: model.text(),
    provider_id: model.text(),
    environment: model.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
    is_enabled: model.boolean().default(false),
    configuration: model.json(),
    encrypted_secret: model.text().nullable(),
    encryption_iv: model.text().nullable(),
    encryption_tag: model.text().nullable(),
    key_version: model.text().nullable(),
    secret_hint: model.text().nullable(),
    last_verified_at: model.dateTime().nullable(),
    last_verification: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_shipping_carrier_connection_code",
      on: ["code"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_shipping_carrier_connection_provider",
      on: ["provider_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default ShippingCarrierConnection
