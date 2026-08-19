import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { configureZaloChannelGuiWorkflow } from "../../../../../workflows/agent-operations/configure-zalo-channel-gui"
import { AdminConfigureZaloChannelType } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureZaloChannelType>,
  res: MedusaResponse
) {
  const { result } = await configureZaloChannelGuiWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json(result)
}
