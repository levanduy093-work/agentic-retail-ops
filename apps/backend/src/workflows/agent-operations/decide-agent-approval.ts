import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { ApprovalDecisionInput } from "../../modules/agent-operations/types"

const decideAgentApprovalStep = createStep(
  "decide-agent-approval",
  async (input: ApprovalDecisionInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.decideApproval(input)

    return new StepResponse(result)
  }
)

export const decideAgentApprovalWorkflow = createWorkflow(
  "decide-agent-approval",
  function (input: ApprovalDecisionInput) {
    const result = decideAgentApprovalStep(input)
    return new WorkflowResponse(result)
  }
)
