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
import { DisconnectAiProviderInput } from "../../modules/agent-operations/types"

const disconnectAiProviderStep = createStep(
  "disconnect-ai-provider",
  async (input: DisconnectAiProviderInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const tenantId = input.tenant_id ?? "default"
    const result = await locking.execute(
      `agent-ai-provider:${tenantId}`,
      () => service.disconnectAiProvider({ ...input, tenant_id: tenantId })
    )
    return new StepResponse(result)
  }
)

export const disconnectAiProviderWorkflow = createWorkflow(
  "disconnect-ai-provider",
  function (input: DisconnectAiProviderInput) {
    return new WorkflowResponse(disconnectAiProviderStep(input))
  }
)
