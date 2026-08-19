import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { disconnectZaloChannelWorkflow } from "../../../../../../workflows/agent-operations/disconnect-zalo-channel"
import { AdminDisconnectZaloChannelType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDisconnectZaloChannelType>,
  res: MedusaResponse
) {
  const { result } = await disconnectZaloChannelWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
