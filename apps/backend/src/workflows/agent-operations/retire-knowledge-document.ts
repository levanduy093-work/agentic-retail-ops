import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { RetireKnowledgeDocumentInput } from "../../modules/agent-operations/types"

const retireKnowledgeDocumentStep = createStep(
  "retire-knowledge-document",
  async (input: RetireKnowledgeDocumentInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    return new StepResponse(
      await locking.execute(
        `agent-knowledge:${input.document_id}`,
        async () => {
          const retirement = await service.retireGovernedKnowledgeDocument(input)
          const rag_index = await service.removeGovernedKnowledgeDocumentIndex(
            input.document_id
          )
          return { ...retirement, rag_index }
        }
      )
    )
  }
)

export const retireKnowledgeDocumentWorkflow = createWorkflow(
  "retire-knowledge-document",
  function (input: RetireKnowledgeDocumentInput) {
    return new WorkflowResponse(retireKnowledgeDocumentStep(input))
  }
)
