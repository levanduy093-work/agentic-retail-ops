import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type DisconnectTikTokChannelInput = {
  account_ref?: string
  actor_id: string
  tenant_id?: string
}

const disconnectTikTokChannelStep = createStep(
  "disconnect-tik-tok-channel",
  async (input: DisconnectTikTokChannelInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.disconnectTikTokChannel(input)
    return new StepResponse(result)
  }
)

export const disconnectTikTokChannelWorkflow = createWorkflow(
  "disconnect-tik-tok-channel",
  function (input: DisconnectTikTokChannelInput) {
    return new WorkflowResponse(disconnectTikTokChannelStep(input))
  }
)
