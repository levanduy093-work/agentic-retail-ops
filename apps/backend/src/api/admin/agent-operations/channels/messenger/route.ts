import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { configureMessengerChannelGuiWorkflow } from "../../../../../workflows/agent-operations/configure-messenger-channel-gui"
import { AdminConfigureMessengerChannelType } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureMessengerChannelType>,
  res: MedusaResponse
) {
  const { result } = await configureMessengerChannelGuiWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
