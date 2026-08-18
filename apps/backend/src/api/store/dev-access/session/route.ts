import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DevAccessStore } from "../../../../lib/dev-access/dev-access-store"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as { session_token?: string }
  res.json({ valid: DevAccessStore.verifySessionToken(body?.session_token || "") })
}
