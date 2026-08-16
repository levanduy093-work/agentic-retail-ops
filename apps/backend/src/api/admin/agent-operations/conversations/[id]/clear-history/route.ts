import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { clearCustomerConversationHistoryWorkflow } from "../../../../../../workflows/agent-operations/clear-customer-conversation-history"
import { AdminClearAgentConversationType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminClearAgentConversationType>,
  res: MedusaResponse
) {
  const { result } = await clearCustomerConversationHistoryWorkflow(
    req.scope
  ).run({
    input: {
      actor_id: req.auth_context.actor_id,
      conversation_id: req.params.id,
      idempotency_key: req.validatedBody.idempotency_key,
    },
  })

  res.json(result)
}
