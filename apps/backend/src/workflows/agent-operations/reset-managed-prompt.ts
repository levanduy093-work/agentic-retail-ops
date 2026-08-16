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

export type ResetManagedPromptWorkflowInput = {
  actor_id?: string
  prompt_key: string
}

const resetManagedPromptStep = createStep(
  "reset-managed-prompt",
  async (input: ResetManagedPromptWorkflowInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    const result = await locking.execute("agent-prompt:managed-configuration", async () => {
      return await service.resetManagedPrompt({
        actor_id: input.actor_id,
        prompt_key: input.prompt_key,
      })
    })

    return new StepResponse(result)
  }
)

export const resetManagedPromptWorkflow = createWorkflow(
  "reset-managed-prompt",
  function (input: ResetManagedPromptWorkflowInput) {
    return new WorkflowResponse(resetManagedPromptStep(input))
  }
)
