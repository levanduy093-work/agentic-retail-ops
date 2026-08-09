import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { approveKnowledgeDocumentWorkflow } from "../../../../../../workflows/agent-operations/approve-knowledge-document"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await approveKnowledgeDocumentWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      document_id: req.params.id,
    },
  })
  res.status(result.duplicate ? 200 : 201).json(result)
}
