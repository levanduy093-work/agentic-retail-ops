import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { CreateKnowledgeDocumentInput } from "../../modules/agent-operations/types"

const createKnowledgeDocumentStep = createStep(
  "create-knowledge-document",
  async (input: CreateKnowledgeDocumentInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    return new StepResponse(
      await locking.execute(
        `agent-knowledge:${input.document_key}:${input.version}`,
        () => service.createGovernedKnowledgeDocument(input)
      )
    )
  }
)

export const createKnowledgeDocumentWorkflow = createWorkflow(
  "create-knowledge-document",
  function (input: CreateKnowledgeDocumentInput) {
    return new WorkflowResponse(createKnowledgeDocumentStep(input))
  }
)
import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
