import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { executeAgentActionWorkflow } from "../../../../../../workflows/agent-operations/execute-agent-action"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const actorId = req.auth_context.actor_id
  const { result } = await executeAgentActionWorkflow(req.scope).run({
    input: {
      action_request_id: req.params.id,
      actor_id: actorId,
      actor_type: "user",
      worker_id: `admin-${actorId}`,
    },
  })

  const status = result.action.status === "CONFLICT" ? 409 : result.skipped ? 200 : 202

  res.status(status).json(result)
}
