import assert from "node:assert/strict"
import { existsSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { configureGhnCarrierWorkflow } from "../workflows/shipping-hub/configure-ghn-carrier"
import { GhnSettingsStore } from "../modules/ghn-fulfillment/services/ghn-settings-store"

const LEGACY_SETTINGS_PATH = resolve(process.cwd(), ".ghn-settings.json")

export default async function migrateGhnSettingsToShippingHub({
  container,
}: ExecArgs) {
  const settings = GhnSettingsStore.getLegacySettings()

  assert.ok(
    settings.api_token,
    "A GHN API token is required to migrate the existing connection."
  )
  assert.ok(
    settings.shop_id,
    "A GHN Shop ID is required to migrate the existing connection."
  )

  const { result } = await configureGhnCarrierWorkflow(container).run({
    input: {
      api_token: settings.api_token,
      base_url: settings.base_url,
      client_id: settings.client_id,
      default_height: settings.default_height,
      default_length: settings.default_length,
      default_weight: settings.default_weight,
      default_width: settings.default_width,
      environment: settings.environment,
      is_enabled: true,
      is_insured: settings.is_insured,
      payment_type_id: settings.payment_type_id,
      required_note: settings.required_note,
      sender_address: settings.sender_address,
      sender_district_id: settings.sender_district_id,
      sender_name: settings.sender_name,
      sender_phone: settings.sender_phone,
      sender_province_id: settings.sender_province_id,
      sender_ward_code: settings.sender_ward_code,
      shop_id: settings.shop_id,
    },
  })

  if (existsSync(LEGACY_SETTINGS_PATH)) {
    unlinkSync(LEGACY_SETTINGS_PATH)
  }

  console.log(
    JSON.stringify(
      {
        carrier: result.code,
        legacy_plaintext_file_removed: true,
        secret_persisted: result.has_token,
        status: "SHIPPING_HUB_CREDENTIAL_MIGRATED",
      },
      null,
      2
    )
  )
}
