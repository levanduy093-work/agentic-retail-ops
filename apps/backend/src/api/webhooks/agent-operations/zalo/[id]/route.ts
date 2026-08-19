import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ZaloWebhookPayloadType } from "../../../../admin/agent-operations/validators"
import { ingestZaloWebhookWorkflow } from "../../../../../workflows/agent-operations/ingest-zalo-webhook"

export async function POST(
  req: MedusaRequest<ZaloWebhookPayloadType>,
  res: MedusaResponse
) {
  const signature = String(
    req.headers["x-zes-signature"] ?? req.query.mac ?? ""
  )

  const { result } = await ingestZaloWebhookWorkflow(req.scope).run({
    input: {
      body: req.validatedBody,
      connection_id: req.params.id,
      signature: signature || undefined,
    },
  })

  if (!result.accepted && result.reason === "INVALID_SECRET") {
    return res.status(401).json({ accepted: false, error: "Invalid signature" })
  }
  if (!result.accepted) {
    return res.status(404).json({ accepted: false })
  }

  return res.status(200).json(result)
}
