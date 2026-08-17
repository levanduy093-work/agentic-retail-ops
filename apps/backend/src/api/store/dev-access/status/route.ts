import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DevAccessStore } from "../../../../lib/dev-access/dev-access-store"

export async function GET(
  _req: MedusaRequest,
  res: MedusaResponse
) {
  const settings = DevAccessStore.getSettings()
  res.json({
    access_mode: settings.access_mode,
    is_locked: !settings.public_access_enabled,
    maintenance_message: settings.maintenance_message,
    public_access_enabled: settings.public_access_enabled,
    public_domain: settings.public_domain,
    updated_at: settings.updated_at,
  })
}
