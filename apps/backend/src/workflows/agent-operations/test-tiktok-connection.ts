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
import type { TikTokStoredCredentialPayload } from "../../modules/agent-operations/tiktok"

export type TestTikTokConnectionInput = {
  access_token?: string
  account_ref?: string
  api_base_url?: string
  tenant_id?: string
}

const testTikTokConnectionStep = createStep(
  "test-tik-tok-connection",
  async (input: TestTikTokConnectionInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )

    let token = input.access_token?.trim()
    if (!token) {
      const tenantId = input.tenant_id ?? "default"
      const accountRef = input.account_ref ?? "primary"
      const credentials = await service.listAgentChannelCredentials(
        { account_ref: accountRef, channel: "TIKTOK", tenant_id: tenantId },
        { take: 1 }
      )
      const cred = credentials[0]
      if (cred) {
        const raw = decryptConnectorSecret({
          encrypted_secret: cred.encrypted_secret,
          encryption_iv: cred.encryption_iv,
          encryption_tag: cred.encryption_tag,
          key_version: cred.key_version,
        })
        try {
          const parsed = JSON.parse(raw) as TikTokStoredCredentialPayload
          token = parsed.access_token
        } catch {
          token = raw
        }
      }
    }

    if (!token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "TikTok Access Token is required."
      )
    }

    const accountInfo = await service.testTikTokAccount(
      token,
      input.api_base_url
    )
    return new StepResponse({
      account: accountInfo,
      ok: true,
    })
  }
)

export const testTikTokConnectionWorkflow = createWorkflow(
  "test-tik-tok-connection",
  function (input: TestTikTokConnectionInput) {
    return new WorkflowResponse(testTikTokConnectionStep(input))
  }
)
