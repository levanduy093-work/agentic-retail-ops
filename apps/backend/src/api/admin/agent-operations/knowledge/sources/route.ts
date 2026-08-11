import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { createKnowledgeSourceWorkflow } from "../../../../../workflows/agent-operations/create-knowledge-source"
import {
  AdminCreateKnowledgeSourceType,
} from "../../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [sources, count] = await service.listAndCountAgentKnowledgeSources(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  )
  res.json({ count, sources })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateKnowledgeSourceType>,
  res: MedusaResponse
) {
  const { result } = await createKnowledgeSourceWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      owner_id: req.auth_context.actor_id,
    },
  })
  res.status(result.duplicate ? 200 : 201).json(result)
}
