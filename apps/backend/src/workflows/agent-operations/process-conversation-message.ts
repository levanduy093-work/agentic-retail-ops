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
import { ProcessAgentConversationMessageInput } from "../../modules/agent-operations/types"

const processConversationMessageStep = createStep(
  "process-conversation-message",
  async (input: ProcessAgentConversationMessageInput, { container }) => {
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await locking.execute(
      `agent-communication:message:${input.actor_id}:${input.client_message_id}`,
      async () => service.processAgentConversationMessage(input)
    )

    return new StepResponse(result)
  }
)

export const processConversationMessageWorkflow = createWorkflow(
  "process-conversation-message",
  function (input: ProcessAgentConversationMessageInput) {
    const result = processConversationMessageStep(input)
    return new WorkflowResponse(result)
  }
)
