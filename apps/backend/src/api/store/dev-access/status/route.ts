import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DevAccessStore } from "../../../../lib/dev-access/dev-access-store"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const settings = DevAccessStore.getPublicSettings()
  res.json({
    is_public: settings.public_access_enabled,
    updated_at: settings.updated_at,
  })
}
