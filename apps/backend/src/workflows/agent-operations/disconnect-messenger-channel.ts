import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type DisconnectMessengerChannelInput = {
  account_ref?: string
  actor_id: string
  tenant_id?: string
}

const disconnectMessengerChannelStep = createStep(
  "disconnect-messenger-channel",
  async (input: DisconnectMessengerChannelInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.disconnectMessengerChannel(input)
    return new StepResponse(result)
  }
)

export const disconnectMessengerChannelWorkflow = createWorkflow(
  "disconnect-messenger-channel",
  function (input: DisconnectMessengerChannelInput) {
    return new WorkflowResponse(disconnectMessengerChannelStep(input))
  }
)
