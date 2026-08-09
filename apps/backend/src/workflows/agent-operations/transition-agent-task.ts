import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { TransitionAgentTaskInput } from "../../modules/agent-operations/types"

const transitionAgentTaskStep = createStep(
  "transition-agent-task",
  async (input: TransitionAgentTaskInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    return new StepResponse(
      await locking.execute(`agent-task:${input.task_id}`, () =>
        service.transitionGovernedAgentTask(input)
      )
    )
  }
)

export const transitionAgentTaskWorkflow = createWorkflow(
  "transition-agent-task",
  function (input: TransitionAgentTaskInput) {
    return new WorkflowResponse(transitionAgentTaskStep(input))
  }
)
import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
