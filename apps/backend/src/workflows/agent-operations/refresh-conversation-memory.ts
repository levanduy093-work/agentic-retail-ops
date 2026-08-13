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

export type RefreshConversationMemoryInput = {
  conversation_id: string
}

const refreshConversationMemoryStep = createStep(
  "refresh-conversation-memory",
  async (input: RefreshConversationMemoryInput, { container }) => {
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await locking.execute(
      `conversation-memory:${input.conversation_id}`,
      () => service.refreshConversationMemory(input.conversation_id)
    )
    return new StepResponse(result)
  }
)

export const refreshConversationMemoryWorkflow = createWorkflow(
  "refresh-conversation-memory",
  function (input: RefreshConversationMemoryInput) {
    return new WorkflowResponse(refreshConversationMemoryStep(input))
  }
)
