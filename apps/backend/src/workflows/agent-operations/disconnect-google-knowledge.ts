import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import { revokeGoogleKnowledgeAccess } from "../../modules/agent-operations/google-knowledge-oauth"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { DisconnectGoogleKnowledgeConnectorInput } from "../../modules/agent-operations/types"

const disconnectGoogleKnowledgeStep = createStep(
  "disconnect-google-knowledge",
  async (input: DisconnectGoogleKnowledgeConnectorInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const tenantId = input.tenant_id ?? "default"

    return new StepResponse(
      await locking.execute(
        `agent-connector-credential:${tenantId}:GOOGLE_DRIVE`,
        async () => {
          let remote_revoked = false
          try {
            const refreshToken =
              await service.getGoogleKnowledgeRefreshToken(tenantId)
            await revokeGoogleKnowledgeAccess(refreshToken)
            remote_revoked = true
          } catch {
            remote_revoked = false
          }
          const result = await service.disconnectGoogleKnowledgeConnector(input)
          return { ...result, remote_revoked }
        }
      )
    )
  }
)

export const disconnectGoogleKnowledgeWorkflow = createWorkflow(
  "disconnect-google-knowledge",
  function (input: DisconnectGoogleKnowledgeConnectorInput) {
    return new WorkflowResponse(disconnectGoogleKnowledgeStep(input))
  }
)
