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
import { ReleaseAgentTaskInput } from "../../modules/agent-operations/types"

const releaseAgentTaskStep = createStep(
  "release-agent-task",
  async (input: ReleaseAgentTaskInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    return new StepResponse(
      await locking.execute(`agent-task:${input.task_id}`, () =>
        service.releaseGovernedAgentTask(input)
      )
    )
  }
)

export const releaseAgentTaskWorkflow = createWorkflow(
  "release-agent-task",
  function (input: ReleaseAgentTaskInput) {
    return new WorkflowResponse(releaseAgentTaskStep(input))
  }
)
