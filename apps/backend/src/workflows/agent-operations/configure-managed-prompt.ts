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
import { AssistantSettings } from "../../modules/agent-operations/assistant-settings"

export type ConfigureManagedPromptWorkflowInput = {
  actor_id?: string
  max_tokens?: number
  prompt_key?: string
  settings?: Partial<AssistantSettings>
  system_prompt?: string
}

const configureManagedPromptStep = createStep(
  "configure-managed-prompt",
  async (input: ConfigureManagedPromptWorkflowInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    const result = await locking.execute("agent-prompt:managed-configuration", async () => {
      if (input.settings) {
        await service.configureAssistantSettings({
          actor_id: input.actor_id,
          settings: input.settings,
        })
      } else if (input.prompt_key && input.system_prompt) {
        await service.configureManagedPrompt({
          actor_id: input.actor_id,
          max_tokens: input.max_tokens,
          prompt_key: input.prompt_key,
          system_prompt: input.system_prompt,
        })
      }
      return await service.listAllPromptsAndSettings()
    })

    return new StepResponse(result)
  }
)

export const configureManagedPromptWorkflow = createWorkflow(
  "configure-managed-prompt",
  function (input: ConfigureManagedPromptWorkflowInput) {
    return new WorkflowResponse(configureManagedPromptStep(input))
  }
)
