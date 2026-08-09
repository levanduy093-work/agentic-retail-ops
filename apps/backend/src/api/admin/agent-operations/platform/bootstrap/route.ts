import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { bootstrapAgentPlatformWorkflow } from "../../../../../workflows/agent-operations/bootstrap-agent-platform"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await bootstrapAgentPlatformWorkflow(req.scope).run({
    input: { actor_id: req.auth_context.actor_id },
  })
  res.json(result)
}
