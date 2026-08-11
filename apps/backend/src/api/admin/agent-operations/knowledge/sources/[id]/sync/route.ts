import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { syncKnowledgeSourceWorkflow } from "../../../../../../../workflows/agent-operations/sync-knowledge-source"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await syncKnowledgeSourceWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      source_id: req.params.id,
    },
  })
  res.status(result.status === "FAILED" ? 422 : 200).json(result)
}
