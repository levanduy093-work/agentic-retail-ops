import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { createKnowledgeDocumentWorkflow } from "../../../../workflows/agent-operations/create-knowledge-document"
import { AdminCreateKnowledgeDocumentType } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [documents, count] = await service.listAndCountAgentKnowledgeDocuments(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  )
  res.json({ count, documents })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateKnowledgeDocumentType>,
  res: MedusaResponse
) {
  const { result } = await createKnowledgeDocumentWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      owner_id: req.auth_context.actor_id,
    },
  })
  res.status(result.duplicate ? 200 : 201).json(result)
}
