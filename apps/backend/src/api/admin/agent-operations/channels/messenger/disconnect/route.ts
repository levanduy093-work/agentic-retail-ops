import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { disconnectMessengerChannelWorkflow } from "../../../../../../workflows/agent-operations/disconnect-messenger-channel"
import { AdminDisconnectMessengerChannelType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDisconnectMessengerChannelType>,
  res: MedusaResponse
) {
  const { result } = await disconnectMessengerChannelWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
