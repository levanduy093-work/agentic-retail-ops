import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type DisconnectTelegramChannelInput = {
  account_ref?: string
  actor_id: string
  tenant_id?: string
}

const disconnectTelegramChannelStep = createStep(
  "disconnect-telegram-channel",
  async (input: DisconnectTelegramChannelInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.disconnectTelegramChannel(input)
    return new StepResponse(result)
  }
)

export const disconnectTelegramChannelWorkflow = createWorkflow(
  "disconnect-telegram-channel",
  function (input: DisconnectTelegramChannelInput) {
    return new WorkflowResponse(disconnectTelegramChannelStep(input))
  }
)
