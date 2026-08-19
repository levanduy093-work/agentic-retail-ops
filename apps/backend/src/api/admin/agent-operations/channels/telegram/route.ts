import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { configureTelegramChannelGuiWorkflow } from "../../../../../workflows/agent-operations/configure-telegram-channel-gui"
import { AdminConfigureTelegramChannelType } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureTelegramChannelType>,
  res: MedusaResponse
) {
  const { result } = await configureTelegramChannelGuiWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
