import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"

const memoryItems = (value: unknown) =>
  value &&
  typeof value === "object" &&
  Array.isArray((value as { items?: unknown }).items)
    ? (value as { items: string[] }).items
    : []

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const conversation = await service.retrieveAgentConversation(req.params.id)
  const messages = await service.listAgentMessages(
    { conversation_id: conversation.id },
    { order: { occurred_at: "ASC" } }
  )
  const memory = (
    await service.listAgentConversationMemories(
      { conversation_id: conversation.id },
      { take: 1 }
    )
  )[0]
  const supportTasks = await service.listAgentTasks(
    {
      conversation_id: conversation.id,
      task_type: "SUPPORT_RESPONSE_REVIEW",
    },
    { order: { created_at: "DESC" }, take: 20 }
  )

  res.json({
    conversation,
    memory: memory
      ? {
          ...memory,
          customer_facts: memoryItems(memory.customer_facts),
          open_questions: memoryItems(memory.open_questions),
          resolved_topics: memoryItems(memory.resolved_topics),
        }
      : null,
    messages,
    support_tasks: supportTasks,
  })
}
