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

const imageAttachments = (value: unknown) => {
  if (!value || typeof value !== "object") return []
  const attachments = (value as { image_attachments?: unknown })
    .image_attachments
  if (!Array.isArray(attachments)) return []
  return attachments.flatMap((attachment) => {
    if (
      attachment &&
      typeof attachment === "object" &&
      typeof (attachment as { id?: unknown }).id === "string" &&
      typeof (attachment as { url?: unknown }).url === "string"
    ) {
      return [
        {
          id: (attachment as { id: string }).id,
          url: (attachment as { url: string }).url,
        },
      ]
    }
    return []
  })
}

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
    messages: messages.map((message) => ({
      body: message.body,
      direction: message.direction,
      id: message.id,
      image_attachments: imageAttachments(message.structured_content),
      occurred_at: message.occurred_at,
      sender_type: message.sender_type,
      status: message.status,
    })),
    support_tasks: supportTasks,
  })
}
