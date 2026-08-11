import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { disconnectGoogleKnowledgeWorkflow } from "../../../../../../../workflows/agent-operations/disconnect-google-knowledge"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await disconnectGoogleKnowledgeWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      tenant_id: "default",
    },
  })
  res.status(200).json(result)
}
