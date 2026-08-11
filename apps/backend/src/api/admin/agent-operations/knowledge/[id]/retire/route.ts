import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { retireKnowledgeDocumentWorkflow } from "../../../../../../workflows/agent-operations/retire-knowledge-document"
import { AdminRetireKnowledgeDocumentType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminRetireKnowledgeDocumentType>,
  res: MedusaResponse
) {
  const { result } = await retireKnowledgeDocumentWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      document_id: req.params.id,
      reason: req.validatedBody.reason,
    },
  })
  res.status(result.duplicate ? 200 : 201).json(result)
}
