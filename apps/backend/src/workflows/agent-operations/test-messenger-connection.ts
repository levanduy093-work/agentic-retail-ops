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
import type { FacebookStoredCredentialPayload } from "../../modules/agent-operations/facebook"

export type TestMessengerConnectionInput = {
  account_ref?: string
  api_base_url?: string
  page_access_token?: string
  tenant_id?: string
}

const testMessengerConnectionStep = createStep(
  "test-messenger-connection",
  async (input: TestMessengerConnectionInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )

    let token = input.page_access_token?.trim()
    if (!token) {
      const tenantId = input.tenant_id ?? "default"
      const accountRef = input.account_ref ?? "primary"
      const credentials = await service.listAgentChannelCredentials(
        { account_ref: accountRef, channel: "MESSENGER", tenant_id: tenantId },
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
          const parsed = JSON.parse(raw) as FacebookStoredCredentialPayload
          token = parsed.page_access_token
        } catch {
          token = raw
        }
      }
    }

    if (!token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Facebook Page Access Token is required."
      )
    }

    const pageInfo = await service.testFacebookPageToken(
      token,
      input.api_base_url
    )
    return new StepResponse({
      ok: true,
      page: pageInfo,
    })
  }
)

export const testMessengerConnectionWorkflow = createWorkflow(
  "test-messenger-connection",
  function (input: TestMessengerConnectionInput) {
    return new WorkflowResponse(testMessengerConnectionStep(input))
  }
)
