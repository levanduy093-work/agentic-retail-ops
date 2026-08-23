import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import type { TikTokChannelIdentity } from "../../modules/agent-operations/tiktok"
import type { CustomerChatSecurityConfig } from "../../modules/agent-operations/customer-chat-security"

export type ConfigureTikTokChannelGuiInput = {
  access_token?: string
  account_ref?: string
  actor_id: string
  allow_unmapped_users?: boolean
  api_base_url?: string
  client_key?: string
  client_secret?: string
  identities?: TikTokChannelIdentity[]
  public_base_url: string
  refresh_token?: string
  security?: Partial<CustomerChatSecurityConfig>
  tenant_id?: string
  webhook_secret?: string
}

const configureTikTokChannelGuiStep = createStep(
  "configure-tik-tok-channel-gui",
  async (input: ConfigureTikTokChannelGuiInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.configureTikTokChannelGui(input)
    return new StepResponse(result)
  }
)

export const configureTikTokChannelGuiWorkflow = createWorkflow(
  "configure-tik-tok-channel-gui",
  function (input: ConfigureTikTokChannelGuiInput) {
    return new WorkflowResponse(configureTikTokChannelGuiStep(input))
  }
)
