import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { processConversationMessageWorkflow } from "../../../../../../workflows/agent-operations/process-conversation-message"
import { AdminSendAgentConversationMessageType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSendAgentConversationMessageType>,
  res: MedusaResponse
) {
  const { result } = await processConversationMessageWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      body: req.validatedBody.body,
      client_message_id: req.validatedBody.client_message_id,
      command: req.validatedBody.command,
      conversation_id: req.params.id,
    },
  })
  const status = result.accepted
    ? result.duplicate
      ? 200
      : 201
    : 409

  res.status(status).json(result)
}
