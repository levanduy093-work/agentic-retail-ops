import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { CreateAgentTaskInput } from "../../modules/agent-operations/types"

const createAgentTaskStep = createStep(
  "create-agent-task",
  async (input: CreateAgentTaskInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    return new StepResponse(
      await locking.execute(
        `agent-task-idempotency:${input.idempotency_key}`,
        () => service.createGovernedAgentTask(input)
      )
    )
  }
)

export const createAgentTaskWorkflow = createWorkflow(
  "create-agent-task",
  function (input: CreateAgentTaskInput) {
    return new WorkflowResponse(createAgentTaskStep(input))
  }
)
import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
