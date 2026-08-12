import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { prepareKnowledgeSourceWorkflow } from "../../../../../../../workflows/agent-operations/prepare-knowledge-source"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await prepareKnowledgeSourceWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      source_id: req.params.id,
    },
  })
  res.status(result.rag_index.status === "INDEXED" ? 200 : 422).json(result)
}
