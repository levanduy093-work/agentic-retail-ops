import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { AdminSearchKnowledgeType } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSearchKnowledgeType>,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const result = await service.searchGovernedKnowledge({
    ...req.validatedBody,
    scope: "customer_support",
  })
  res.json(result)
}
