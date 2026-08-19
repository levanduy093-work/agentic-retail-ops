import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import type { TelegramChannelIdentity } from "../../modules/agent-operations/telegram"
import type { CustomerChatSecurityConfig } from "../../modules/agent-operations/customer-chat-security"

export type ConfigureTelegramChannelGuiInput = {
  account_ref?: string
  actor_id: string
  allow_unmapped_users?: boolean
  api_base_url?: string
  bot_token?: string
  identities?: TelegramChannelIdentity[]
  public_base_url: string
  security?: Partial<CustomerChatSecurityConfig>
  tenant_id?: string
  webhook_secret?: string
}

const configureTelegramChannelGuiStep = createStep(
  "configure-telegram-channel-gui",
  async (input: ConfigureTelegramChannelGuiInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.configureTelegramChannelGui(input)
    return new StepResponse(result)
  }
)

export const configureTelegramChannelGuiWorkflow = createWorkflow(
  "configure-telegram-channel-gui",
  function (input: ConfigureTelegramChannelGuiInput) {
    return new WorkflowResponse(configureTelegramChannelGuiStep(input))
  }
)
