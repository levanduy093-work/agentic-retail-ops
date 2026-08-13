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
import { ProcessTelegramKnowledgeQuestionInput } from "../../modules/agent-operations/types"

const answerTelegramKnowledgeQuestionStep = createStep(
  "answer-telegram-knowledge-question",
  async (input: ProcessTelegramKnowledgeQuestionInput, { container }) => {
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await locking.execute(
      `telegram-knowledge-answer:${input.inbound_message_id}`,
      () => service.processTelegramKnowledgeQuestion(input)
    )

    return new StepResponse(result)
  }
)

export const answerTelegramKnowledgeQuestionWorkflow = createWorkflow(
  "answer-telegram-knowledge-question",
  function (input: ProcessTelegramKnowledgeQuestionInput) {
    return new WorkflowResponse(answerTelegramKnowledgeQuestionStep(input))
  }
)
