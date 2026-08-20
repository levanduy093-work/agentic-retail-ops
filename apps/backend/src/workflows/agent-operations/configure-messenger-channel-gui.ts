import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import type { FacebookMessengerIdentity } from "../../modules/agent-operations/facebook"
import type { CustomerChatSecurityConfig } from "../../modules/agent-operations/customer-chat-security"

export type ConfigureMessengerChannelGuiInput = {
  account_ref?: string
  actor_id: string
  allow_unmapped_users?: boolean
  api_base_url?: string
  app_id?: string
  app_secret?: string
  identities?: FacebookMessengerIdentity[]
  page_access_token?: string
  public_base_url: string
  security?: Partial<CustomerChatSecurityConfig>
  tenant_id?: string
  verify_token?: string
}

const configureMessengerChannelGuiStep = createStep(
  "configure-messenger-channel-gui",
  async (input: ConfigureMessengerChannelGuiInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.configureMessengerChannelGui(input)
    return new StepResponse(result)
  }
)

export const configureMessengerChannelGuiWorkflow = createWorkflow(
  "configure-messenger-channel-gui",
  function (input: ConfigureMessengerChannelGuiInput) {
    return new WorkflowResponse(configureMessengerChannelGuiStep(input))
  }
)
