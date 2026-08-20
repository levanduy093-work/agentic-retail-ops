import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { sendDirectSupportMessageWorkflow } from "../../../../../../workflows/agent-operations/send-direct-support-message"
import { AdminSendDirectSupportMessageType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSendDirectSupportMessageType>,
  res: MedusaResponse
) {
  const { result } = await sendDirectSupportMessageWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      body: req.validatedBody.body,
      client_message_id: req.validatedBody.client_message_id,
      conversation_id: req.params.id,
    },
  })

  res.status(200).json(result)
}
