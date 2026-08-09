import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

type RunAgentEvaluationInput = {
  idempotency_key: string
  observed: Record<string, unknown>
  scenario_id: string
}

const runAgentEvaluationStep = createStep(
  "run-agent-evaluation",
  async (input: RunAgentEvaluationInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    return new StepResponse(
      await locking.execute(
        `agent-evaluation:${input.idempotency_key}`,
        () => service.runAgentEvaluation(input)
      )
    )
  }
)

export const runAgentEvaluationWorkflow = createWorkflow(
  "run-agent-evaluation",
  function (input: RunAgentEvaluationInput) {
    return new WorkflowResponse(runAgentEvaluationStep(input))
  }
)
import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
