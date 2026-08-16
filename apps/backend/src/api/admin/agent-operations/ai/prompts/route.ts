import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { configureManagedPromptWorkflow } from "../../../../../workflows/agent-operations/configure-managed-prompt"
import { AdminConfigureManagedPromptType } from "../../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const result = await service.listAllPromptsAndSettings()
  res.json(result)
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureManagedPromptType>,
  res: MedusaResponse
) {
  const { result } = await configureManagedPromptWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      max_tokens: req.validatedBody.max_tokens,
      prompt_key: req.validatedBody.prompt_key,
      settings: req.validatedBody.settings,
      system_prompt: req.validatedBody.system_prompt,
    },
  })
  res.status(200).json(result)
}
