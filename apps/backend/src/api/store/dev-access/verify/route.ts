import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DevAccessStore } from "../../../../lib/dev-access/dev-access-store"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as { passcode?: string }
  if (!DevAccessStore.verifyPasscode(body?.passcode || "")) {
    res.status(401).json({ message: "Mã PIN không chính xác.", success: false })
    return
  }

  res.json({ session_token: DevAccessStore.createSessionToken(), success: true })
}
