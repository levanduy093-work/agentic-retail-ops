import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { disconnectTelegramChannelWorkflow } from "../../../../../../workflows/agent-operations/disconnect-telegram-channel"
import { AdminDisconnectTelegramChannelType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDisconnectTelegramChannelType>,
  res: MedusaResponse
) {
  const { result } = await disconnectTelegramChannelWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
