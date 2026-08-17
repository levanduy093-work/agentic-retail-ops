import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  GhtkWebhookInput,
  ingestGhtkWebhookWorkflow,
} from "../../../../workflows/shipping-hub/ingest-ghtk-webhook"

type GhtkWebhookPayload = GhtkWebhookInput & {
  action_time?: string
  fee?: number
  label_id: string
  partner_id?: string
  reason?: string
  reason_code?: string
  return_part_package?: number
  status_id: number
  weight?: number
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as GhtkWebhookPayload

  if (!body?.label_id) {
    res
      .status(400)
      .json({ message: "Invalid webhook payload: label_id missing" })
    return
  }

  const { result } = await ingestGhtkWebhookWorkflow(req.scope).run({
    input: body,
  })

  res.status(200).json({
    duplicate: result.event.duplicate,
    success: true,
  })
}
