import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type ToggleConversationAiInput = {
  actor_id: string
  conversation_id: string
  paused: boolean
}

export type ToggleConversationAiResult = {
  conversation: Awaited<
    ReturnType<AgentOperationsModuleService["retrieveAgentConversation"]>
  >
  paused: boolean
  success: boolean
}

const toggleConversationAiStep = createStep<
  ToggleConversationAiInput,
  ToggleConversationAiResult,
  undefined
>(
  "toggle-conversation-ai",
  async (input: ToggleConversationAiInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const conversation = await service.retrieveAgentConversation(
      input.conversation_id
    )
    const metadata = (conversation.metadata ?? {}) as Record<string, unknown>
    const isPaused = Boolean(input.paused)

    const updated = await service.updateAgentConversations({
      id: conversation.id,
      metadata: {
        ...metadata,
        ai_paused: isPaused,
        ai_paused_at: isPaused ? new Date().toISOString() : null,
        ai_paused_by: isPaused ? input.actor_id : null,
      },
    })

    await service.createAgentAuditEvents({
      action: isPaused ? "conversation-ai-paused" : "conversation-ai-resumed",
      actor_id: input.actor_id,
      actor_type: "user",
      correlation_id: `toggle-ai:${conversation.id}:${Date.now()}`,
      data: {
        ai_paused: isPaused,
        conversation_id: conversation.id,
      },
      event_type: isPaused
        ? "agent.conversation.ai-paused"
        : "agent.conversation.ai-resumed",
      recorded_at: new Date(),
      resource_id: conversation.id,
      resource_type: "agent_conversation",
    })

    return new StepResponse<ToggleConversationAiResult>({
      conversation: updated,
      paused: isPaused,
      success: true,
    })
  }
)

export const toggleConversationAiWorkflow = createWorkflow(
  "toggle-conversation-ai",
  function (input: ToggleConversationAiInput) {
    const result = toggleConversationAiStep(input)
    return new WorkflowResponse(result)
  }
)
