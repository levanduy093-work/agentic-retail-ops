import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { ConfigureAiProviderInput } from "../../modules/agent-operations/types"

const configureAiProviderStep = createStep(
  "configure-ai-provider",
  async (input: ConfigureAiProviderInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const tenantId = input.tenant_id ?? "default"
    const result = await locking.execute(
      `agent-ai-provider:${tenantId}`,
      () => service.configureAiProvider({ ...input, tenant_id: tenantId })
    )
    return new StepResponse(result)
  }
)

const reindexKnowledgeForAiProviderStep = createStep(
  "reindex-knowledge-for-ai-provider",
  async (input: { tenant_id?: string }, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    return new StepResponse(
      await service.reindexGovernedKnowledge(input.tenant_id ?? "default")
    )
  }
)

export const configureAiProviderWorkflow = createWorkflow(
  "configure-ai-provider",
  function (input: ConfigureAiProviderInput) {
    const provider = configureAiProviderStep(input)
    const knowledge_index = reindexKnowledgeForAiProviderStep(input)
    return new WorkflowResponse({ knowledge_index, provider })
  }
)
