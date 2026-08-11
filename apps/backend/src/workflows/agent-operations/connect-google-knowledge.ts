import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import { exchangeGoogleKnowledgeAuthorizationCode } from "../../modules/agent-operations/google-knowledge-oauth"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

type ConnectGoogleKnowledgeInput = {
  actor_id: string
  code: string
  tenant_id?: string
}

const connectGoogleKnowledgeStep = createStep(
  "connect-google-knowledge",
  async (input: ConnectGoogleKnowledgeInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const authorization = await exchangeGoogleKnowledgeAuthorizationCode(
      input.code
    )
    const tenantId = input.tenant_id ?? "default"
    const result = await locking.execute(
      `agent-connector-credential:${tenantId}:GOOGLE_DRIVE`,
      () =>
        service.configureGoogleKnowledgeConnector({
          account_email: authorization.account_email,
          actor_id: input.actor_id,
          refresh_token: authorization.refresh_token,
          scopes: authorization.scopes,
          tenant_id: tenantId,
        })
    )

    return new StepResponse(result)
  }
)

export const connectGoogleKnowledgeWorkflow = createWorkflow(
  "connect-google-knowledge",
  function (input: ConnectGoogleKnowledgeInput) {
    return new WorkflowResponse(connectGoogleKnowledgeStep(input))
  }
)
