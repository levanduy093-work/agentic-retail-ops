import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../../../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../../../modules/agent-operations/service"
import { AiProvider } from "../../../../../../../modules/agent-operations/types"
import { AdminDiscoverAiModelsType } from "../../../../validators"

function parseProvider(value: string): AiProvider {
  const provider = value.toUpperCase()
  if (
    provider !== "OPENAI" &&
    provider !== "GEMINI" &&
    provider !== "DEEPSEEK"
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unsupported AI provider ${value}.`
    )
  }
  return provider
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDiscoverAiModelsType>,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  res.json(
    await service.discoverAiProviderModels({
      api_key: req.validatedBody.api_key,
      provider: parseProvider(req.params.provider),
      tenant_id: "default",
    })
  )
}
