import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { ProcessCustomerKnowledgeQuestionInput } from "../../modules/agent-operations/types"

const answerCustomerKnowledgeQuestionStep = createStep(
  "answer-customer-knowledge-question",
  async (input: ProcessCustomerKnowledgeQuestionInput, { container }) => {
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const inbound = await service.retrieveAgentMessage(input.inbound_message_id)
    const result = await locking.execute(
      `customer-knowledge-answer:${inbound.conversation_id}`,
      () => service.processCustomerKnowledgeQuestion(input)
    )

    return new StepResponse(result)
  }
)

export const answerCustomerKnowledgeQuestionWorkflow = createWorkflow(
  "answer-customer-knowledge-question",
  function (input: ProcessCustomerKnowledgeQuestionInput) {
    return new WorkflowResponse(answerCustomerKnowledgeQuestionStep(input))
  }
)
