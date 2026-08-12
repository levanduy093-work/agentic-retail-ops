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
import { PrepareKnowledgeSourceInput } from "../../modules/agent-operations/types"

const prepareKnowledgeSourceStep = createStep(
  "prepare-knowledge-source",
  async (input: PrepareKnowledgeSourceInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    return new StepResponse(
      await locking.execute(`agent-knowledge-source:${input.source_id}`, () =>
        service.prepareKnowledgeSourceIndex(input)
      )
    )
  }
)

export const prepareKnowledgeSourceWorkflow = createWorkflow(
  "prepare-knowledge-source",
  function (input: PrepareKnowledgeSourceInput) {
    return new WorkflowResponse(prepareKnowledgeSourceStep(input))
  }
)
