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
import { ApproveKnowledgeDocumentInput } from "../../modules/agent-operations/types"

const approveKnowledgeDocumentStep = createStep(
  "approve-knowledge-document",
  async (input: ApproveKnowledgeDocumentInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    return new StepResponse(
      await locking.execute(
        `agent-knowledge:${input.document_id}`,
        async () => {
          const approval = await service.approveGovernedKnowledgeDocument(input)
          const rag_index = await service.indexGovernedKnowledgeDocument(
            input.document_id
          )
          return { ...approval, rag_index }
        }
      )
    )
  }
)

export const approveKnowledgeDocumentWorkflow = createWorkflow(
  "approve-knowledge-document",
  function (input: ApproveKnowledgeDocumentInput) {
    return new WorkflowResponse(approveKnowledgeDocumentStep(input))
  }
)
