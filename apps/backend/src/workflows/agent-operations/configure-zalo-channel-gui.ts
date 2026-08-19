import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import type { ZaloChannelIdentity } from "../../modules/agent-operations/zalo"
import type { CustomerChatSecurityConfig } from "../../modules/agent-operations/customer-chat-security"

export type ConfigureZaloChannelGuiInput = {
  account_ref?: string
  actor_id: string
  allow_unmapped_users?: boolean
  api_base_url?: string
  app_id: string
  secret_key: string
  oa_secret_key?: string
  access_token?: string
  refresh_token?: string
  identities?: ZaloChannelIdentity[]
  public_base_url: string
  security?: Partial<CustomerChatSecurityConfig>
  tenant_id?: string
}

const configureZaloChannelGuiStep = createStep(
  "configure-zalo-channel-gui",
  async (input: ConfigureZaloChannelGuiInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.configureZaloChannelGui(input)
    return new StepResponse(result)
  }
)

export const configureZaloChannelGuiWorkflow = createWorkflow(
  "configure-zalo-channel-gui",
  function (input: ConfigureZaloChannelGuiInput) {
    return new WorkflowResponse(configureZaloChannelGuiStep(input))
  }
)
