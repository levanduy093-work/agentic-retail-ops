import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type DisconnectZaloChannelInput = {
  account_ref?: string
  actor_id: string
  tenant_id?: string
}

const disconnectZaloChannelStep = createStep(
  "disconnect-zalo-channel",
  async (input: DisconnectZaloChannelInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.disconnectZaloChannel(input)
    return new StepResponse(result)
  }
)

export const disconnectZaloChannelWorkflow = createWorkflow(
  "disconnect-zalo-channel",
  function (input: DisconnectZaloChannelInput) {
    return new WorkflowResponse(disconnectZaloChannelStep(input))
  }
)
