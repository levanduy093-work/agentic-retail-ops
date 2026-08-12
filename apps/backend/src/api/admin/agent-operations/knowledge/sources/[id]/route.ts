import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { deleteKnowledgeSourceWorkflow } from "../../../../../../workflows/agent-operations/delete-knowledge-source"

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await deleteKnowledgeSourceWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      source_id: req.params.id,
    },
  })
  res.json(result)
}
