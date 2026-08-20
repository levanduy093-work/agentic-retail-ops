import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { toggleConversationAiWorkflow } from "../../../../../../workflows/agent-operations/toggle-conversation-ai"
import { AdminToggleConversationAiType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminToggleConversationAiType>,
  res: MedusaResponse
) {
  const { result } = await toggleConversationAiWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      conversation_id: req.params.id,
      paused: req.validatedBody.paused,
    },
  })

  res.status(200).json(result)
}
