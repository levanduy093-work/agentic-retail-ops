import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { disconnectTikTokChannelWorkflow } from "../../../../../../workflows/agent-operations/disconnect-tiktok-channel"
import { AdminDisconnectTikTokChannelType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDisconnectTikTokChannelType>,
  res: MedusaResponse
) {
  const { result } = await disconnectTikTokChannelWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
