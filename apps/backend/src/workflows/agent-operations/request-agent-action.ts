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
import { RequestAgentActionInput } from "../../modules/agent-operations/types"

const requestAgentActionStep = createStep(
  "request-agent-action",
  async (input: RequestAgentActionInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const result = await locking.execute(
      `agent-action-idempotency:${input.idempotency_key}`,
      () => service.requestGovernedAgentAction(input)
    )

    return new StepResponse(result)
  }
)

export const requestAgentActionWorkflow = createWorkflow(
  "request-agent-action",
  function (input: RequestAgentActionInput) {
    return new WorkflowResponse(requestAgentActionStep(input))
  }
)
