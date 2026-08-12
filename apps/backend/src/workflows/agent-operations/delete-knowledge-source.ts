import { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { DeleteKnowledgeSourceInput } from "../../modules/agent-operations/types"

const deleteKnowledgeSourceStep = createStep(
  "delete-knowledge-source",
  async (input: DeleteKnowledgeSourceInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    return new StepResponse(
      await locking.execute(
        `agent-knowledge-source:${input.source_id}`,
        async () => {
          const documents = await service.listAgentKnowledgeDocuments(
            { document_key: `source-${input.source_id}` },
            { take: 10_000 }
          )
          const indexedDocuments = documents.filter(
            (document) => document.status !== "DRAFT"
          )

          for (const document of indexedDocuments) {
            const result = await service.removeGovernedKnowledgeDocumentIndex(
              document.id
            )
            if (result.status !== "DELETED") {
              throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Vector cleanup failed for knowledge document ${document.id}.`
              )
            }
          }

          return service.deleteGovernedKnowledgeSource(input)
        }
      )
    )
  }
)

export const deleteKnowledgeSourceWorkflow = createWorkflow(
  "delete-knowledge-source",
  function (input: DeleteKnowledgeSourceInput) {
    return new WorkflowResponse(deleteKnowledgeSourceStep(input))
  }
)
