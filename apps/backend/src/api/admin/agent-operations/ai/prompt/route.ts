import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { configureCustomerSupportPromptWorkflow } from "../../../../../workflows/agent-operations/configure-customer-support-prompt"
import { AdminConfigureAiPromptType } from "../../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  res.json({
    prompt: await service.getCustomerSupportPromptConfiguration(),
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureAiPromptType>,
  res: MedusaResponse
) {
  const { result } = await configureCustomerSupportPromptWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.status(200).json({ prompt: result })
}
