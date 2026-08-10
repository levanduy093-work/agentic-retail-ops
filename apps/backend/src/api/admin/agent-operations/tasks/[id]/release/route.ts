import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { releaseAgentTaskWorkflow } from "../../../../../../workflows/agent-operations/release-agent-task"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await releaseAgentTaskWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      task_id: req.params.id,
    },
  })

  res.json({ task: result })
}
