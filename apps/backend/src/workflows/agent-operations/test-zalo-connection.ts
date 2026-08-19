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
import type { ZaloStoredCredentialPayload } from "../../modules/agent-operations/zalo"

export type TestZaloConnectionInput = {
  access_token?: string
  account_ref?: string
  api_base_url?: string
  tenant_id?: string
}

const testZaloConnectionStep = createStep(
  "test-zalo-connection",
  async (input: TestZaloConnectionInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )

    let token = input.access_token?.trim()
    if (!token) {
      const tenantId = input.tenant_id ?? "default"
      const accountRef = input.account_ref ?? "primary"
      const credentials = await service.listAgentChannelCredentials(
        { account_ref: accountRef, channel: "ZALO", tenant_id: tenantId },
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
          const parsed = JSON.parse(raw) as ZaloStoredCredentialPayload
          token = parsed.access_token
        } catch {
          token = raw
        }
      }
    }

    if (!token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Zalo OA Access Token is required."
      )
    }

    const oaInfo = await service.testZaloOaToken(token, input.api_base_url)
    return new StepResponse({
      oa: oaInfo,
      ok: true,
    })
  }
)

export const testZaloConnectionWorkflow = createWorkflow(
  "test-zalo-connection",
  function (input: TestZaloConnectionInput) {
    return new WorkflowResponse(testZaloConnectionStep(input))
  }
)
