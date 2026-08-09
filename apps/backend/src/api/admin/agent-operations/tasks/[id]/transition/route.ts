import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { transitionAgentTaskWorkflow } from "../../../../../../workflows/agent-operations/transition-agent-task"
import { AdminTransitionAgentTaskType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminTransitionAgentTaskType>,
  res: MedusaResponse
) {
  const { result } = await transitionAgentTaskWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
      task_id: req.params.id,
    },
  })
  res.json({ task: result })
}
