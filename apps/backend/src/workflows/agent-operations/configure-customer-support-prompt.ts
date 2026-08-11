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
import { ConfigureCustomerSupportPromptInput } from "../../modules/agent-operations/types"

const configureCustomerSupportPromptStep = createStep(
  "configure-customer-support-prompt",
  async (input: ConfigureCustomerSupportPromptInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const result = await locking.execute(
      "agent-prompt:customer-support.response-draft",
      () => service.configureCustomerSupportPrompt(input)
    )
    return new StepResponse(result)
  }
)

export const configureCustomerSupportPromptWorkflow = createWorkflow(
  "configure-customer-support-prompt",
  function (input: ConfigureCustomerSupportPromptInput) {
    return new WorkflowResponse(configureCustomerSupportPromptStep(input))
  }
)
