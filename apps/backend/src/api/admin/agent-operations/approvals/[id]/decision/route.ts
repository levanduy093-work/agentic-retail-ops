import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { decideAgentApprovalWorkflow } from "../../../../../../workflows/agent-operations/decide-agent-approval"
import { AdminDecideAgentApprovalType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDecideAgentApprovalType>,
  res: MedusaResponse
) {
  const { result } = await decideAgentApprovalWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      approval_id: req.params.id,
      decision: req.validatedBody.decision,
      reason: req.validatedBody.reason,
    },
  })

  res.status(result.conflict ? 409 : 200).json(result)
}
