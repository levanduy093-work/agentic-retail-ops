import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { decryptConnectorSecret } from "../../modules/agent-operations/credential-vault"

export type TestTelegramConnectionInput = {
  account_ref?: string
  api_base_url?: string
  bot_token?: string
  tenant_id?: string
}

const testTelegramConnectionStep = createStep(
  "test-telegram-connection",
  async (input: TestTelegramConnectionInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )

    let token = input.bot_token?.trim()
    if (!token) {
      const tenantId = input.tenant_id ?? "default"
      const accountRef = input.account_ref ?? "primary"
      const credentials = await service.listAgentChannelCredentials(
        { account_ref: accountRef, channel: "TELEGRAM", tenant_id: tenantId },
        { take: 1 }
      )
      const cred = credentials[0]
      if (cred) {
        token = decryptConnectorSecret({
          encrypted_secret: cred.encrypted_secret,
          encryption_iv: cred.encryption_iv,
          encryption_tag: cred.encryption_tag,
          key_version: cred.key_version,
        })
      } else if (process.env.TELEGRAM_BOT_TOKEN?.trim()) {
        token = process.env.TELEGRAM_BOT_TOKEN.trim()
      }
    }

    if (!token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Telegram Bot Token is required."
      )
    }

    const bot = await service.testTelegramBotToken(
      token,
      input.api_base_url
    )
    return new StepResponse({
      bot,
      ok: true,
    })
  }
)

export const testTelegramConnectionWorkflow = createWorkflow(
  "test-telegram-connection",
  function (input: TestTelegramConnectionInput) {
    return new WorkflowResponse(testTelegramConnectionStep(input))
  }
)
