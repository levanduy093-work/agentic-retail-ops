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

export type ClearCustomerConversationHistoryInput = {
  actor_id: string
  conversation_id: string
  idempotency_key: string
}

const clearCustomerConversationHistoryStep = createStep(
  "clear-customer-conversation-history",
  async (input: ClearCustomerConversationHistoryInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    const result = await locking.execute(
      `agent-conversation-clear:${input.conversation_id}`,
      async () => {
        const conversation = await service.retrieveAgentConversation(
          input.conversation_id
        )
        const [messages, memories, preferences, tasks] = await Promise.all([
          service.listAgentMessages({ conversation_id: conversation.id }),
          service.listAgentConversationMemories(
            { conversation_id: conversation.id },
            { take: 1 }
          ),
          service.listAgentCustomerPreferences({
            source_conversation_id: conversation.id,
          }),
          service.listAgentTasks(
            {
              conversation_id: conversation.id,
            },
            { take: 100 }
          ),
        ])
        const activeTasks = tasks.filter(
          (task) => !["COMPLETED", "CANCELLED", "DEAD"].includes(task.status)
        )
        const now = new Date()
        for (const task of activeTasks) {
          await service.updateAgentTasks({
            completed_at: now,
            failure: "Cancelled due to customer conversation history clear",
            id: task.id,
            status: "CANCELLED",
          })
        }

        if (messages.length) {
          await service.deleteAgentMessages(messages.map((message) => message.id))
        }
        if (memories[0]) {
          await service.deleteAgentConversationMemories(memories[0].id)
        }
        if (preferences.length) {
          await service.deleteAgentCustomerPreferences(
            preferences.map((preference) => preference.id)
          )
        }
        await service.deleteAgentConversations(conversation.id)

        await service.createAgentAuditEvents({
          action: "customer-conversation-history-cleared",
          actor_id: input.actor_id,
          actor_type: "user",
          correlation_id: input.idempotency_key,
          data: {
            cancelled_task_count: activeTasks.length,
            cleared_memory: Boolean(memories[0]),
            cleared_message_count: messages.length,
            cleared_preference_count: preferences.length,
            conversation_id: conversation.id,
          },
          event_type: "agent.conversation.history-cleared",
          recorded_at: now,
          resource_id: conversation.id,
          resource_type: "agent_conversation",
        })

        return {
          cancelled_task_count: activeTasks.length,
          cleared_memory: Boolean(memories[0]),
          cleared_message_count: messages.length,
          cleared_preference_count: preferences.length,
          conversation_id: conversation.id,
        }
      }
    )

    return new StepResponse(result)
  }
)

export const clearCustomerConversationHistoryWorkflow = createWorkflow(
  "clear-customer-conversation-history",
  function (input: ClearCustomerConversationHistoryInput) {
    return new WorkflowResponse(clearCustomerConversationHistoryStep(input))
  }
)
