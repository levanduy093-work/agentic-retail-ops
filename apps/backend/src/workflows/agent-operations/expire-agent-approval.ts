import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { ExpireAgentApprovalInput } from "../../modules/agent-operations/types"

const expireAgentApprovalStep = createStep(
  "expire-agent-approval",
  async (input: ExpireAgentApprovalInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    return new StepResponse(await service.expireAgentApproval(input))
  }
)

export const expireAgentApprovalWorkflow = createWorkflow(
  "expire-agent-approval",
  function (input: ExpireAgentApprovalInput) {
    return new WorkflowResponse(expireAgentApprovalStep(input))
  }
)
