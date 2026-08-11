import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TelegramWebhookUpdateType } from "../../../../admin/agent-operations/validators"
import { ingestTelegramWebhookWorkflow } from "../../../../../workflows/agent-operations/ingest-telegram-webhook"

export async function POST(
  req: MedusaRequest<TelegramWebhookUpdateType>,
  res: MedusaResponse
) {
  const { result } = await ingestTelegramWebhookWorkflow(req.scope).run({
    input: {
      connection_id: req.params.id,
      secret_token: String(
        req.headers["x-telegram-bot-api-secret-token"] ?? ""
      ),
      update: req.validatedBody,
    },
  })

  if (!result.accepted && result.reason === "INVALID_SECRET") {
    return res.status(401).json({ accepted: false })
  }
  if (!result.accepted) {
    return res.status(404).json({ accepted: false })
  }

  return res.status(200).json(result)
}
