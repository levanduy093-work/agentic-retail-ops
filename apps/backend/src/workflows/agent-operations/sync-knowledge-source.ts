import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import { fetchKnowledgeSource } from "../../modules/agent-operations/knowledge-connector"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { SyncKnowledgeSourceInput } from "../../modules/agent-operations/types"

const syncKnowledgeSourceStep = createStep(
  "sync-knowledge-source",
  async (input: SyncKnowledgeSourceInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    return new StepResponse(
      await locking.execute(`agent-knowledge-source:${input.source_id}`, async () => {
        const source = await service.retrieveAgentKnowledgeSource(input.source_id)
        try {
          const googleAuthorizationHeader =
            source.source_type === "HTTPS_TEXT"
              ? undefined
              : `Bearer ${
                  (await service.getGoogleKnowledgePickerToken(
                    source.tenant_id
                  )).access_token
                }`
          const fetchResult = await fetchKnowledgeSource(source.source_url, {
            googleAuthorizationHeader,
            sourceType: source.source_type,
          })
          return service.recordKnowledgeSourceSync({
            ...input,
            fetch_result: fetchResult,
          })
        } catch (error) {
          return service.recordKnowledgeSourceSync({
            ...input,
            failure:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : "Knowledge source sync failed.",
          })
        }
      })
    )
  }
)

export const syncKnowledgeSourceWorkflow = createWorkflow(
  "sync-knowledge-source",
  function (input: SyncKnowledgeSourceInput) {
    return new WorkflowResponse(syncKnowledgeSourceStep(input))
  }
)
