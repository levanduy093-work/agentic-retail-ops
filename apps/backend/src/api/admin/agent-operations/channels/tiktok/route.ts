import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { configureTikTokChannelGuiWorkflow } from "../../../../../workflows/agent-operations/configure-tiktok-channel-gui"
import { AdminConfigureTikTokChannelType } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureTikTokChannelType>,
  res: MedusaResponse
) {
  const { result } = await configureTikTokChannelGuiWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
