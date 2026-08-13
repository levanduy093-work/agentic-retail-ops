import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { CONVERSATION_STATUSES } from "../../../../modules/agent-operations/types"

const serializeMemory = (memory: Record<string, unknown> | null) => {
  if (!memory) return null
  const items = (value: unknown) =>
    value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: string[] }).items
      : []
  return {
    ...memory,
    customer_facts: items(memory.customer_facts),
    open_questions: items(memory.open_questions),
    resolved_topics: items(memory.resolved_topics),
  }
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const rawLimit = Number(req.query.limit ?? 20)
  const rawOffset = Number(req.query.offset ?? 0)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 20
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0
  const status = typeof req.query.status === "string" ? req.query.status : null
  const customerSupport = req.query.customer_support === "true"
  const filters = {
    ...(status && CONVERSATION_STATUSES.includes(status as never)
      ? { status }
      : {}),
    ...(customerSupport
      ? { topic_type: ["CUSTOMER_SUPPORT", "CUSTOMER_SUPPORT_CHAT"] }
      : {}),
  }
  const [conversations, count] =
    await service.listAndCountAgentConversations(filters, {
      order: { last_message_at: "DESC" },
      skip: offset,
      take: limit,
    })
  const conversationIds = conversations.map((conversation) => conversation.id)
  const [messages, memories, tasks] = conversationIds.length
    ? await Promise.all([
        service.listAgentMessages(
          { conversation_id: conversationIds },
          { order: { occurred_at: "DESC" }, take: limit * 10 }
        ),
        service.listAgentConversationMemories(
          { conversation_id: conversationIds },
          { take: limit }
        ),
        service.listAgentTasks(
          {
            conversation_id: conversationIds,
            task_type: "SUPPORT_RESPONSE_REVIEW",
          },
          { order: { created_at: "DESC" }, take: limit * 5 }
        ),
      ])
    : [[], [], []]
  const latestMessageByConversation = new Map()
  for (const message of messages) {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, message)
    }
  }
  const memoryByConversation = new Map(
    memories.map((memory) => [memory.conversation_id, memory])
  )
  const latestTaskByConversation = new Map()
  for (const task of tasks) {
    if (
      task.conversation_id &&
      !latestTaskByConversation.has(task.conversation_id)
    ) {
      latestTaskByConversation.set(task.conversation_id, task)
    }
  }

  res.json({
    conversations: conversations.map((conversation) => {
      const supportTask = latestTaskByConversation.get(conversation.id) ?? null
      return {
        ...conversation,
        latest_message: latestMessageByConversation.get(conversation.id) ?? null,
        memory: serializeMemory(
          (memoryByConversation.get(conversation.id) as Record<
            string,
            unknown
          > | null) ?? null
        ),
        requires_human_attention: Boolean(
          supportTask &&
            !["COMPLETED", "CANCELLED", "DEAD"].includes(supportTask.status)
        ),
        support_task: supportTask,
      }
    }),
    count,
    limit,
    offset,
  })
}
