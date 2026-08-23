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

  const metadata = (conversation.metadata ?? {}) as Record<string, unknown>
  const customerName =
    (typeof metadata.customer_name === "string" && metadata.customer_name.trim()) ||
    (typeof metadata.sender_name === "string" && metadata.sender_name.trim()) ||
    (typeof metadata.facebook_user_name === "string" && metadata.facebook_user_name.trim()) ||
    (typeof metadata.telegram_user_name === "string" && metadata.telegram_user_name.trim()) ||
    (conversation.title &&
      !/^(Facebook|Telegram|Zalo|TikTok|Messenger|Chat)\s+[—–-]\s+\d+$/iu.test(conversation.title) &&
      conversation.title.replace(/^(Facebook|Telegram|Zalo|TikTok|Messenger|Chat)\s+[—–-]\s+/iu, "").trim()) ||
    null

  const senderId =
    messages.find((m) => m.direction === "INBOUND")?.sender_id ??
    (metadata.mapped_user_id as string | undefined)
  let customerPreferences: Array<{
    expires_at: Date
    preference_type: string
    status: string
    value: string
  }> = []
  if (senderId) {
    try {
      customerPreferences = await service.listAgentCustomerPreferences(
        { customer_id: senderId, tenant_id: conversation.tenant_id },
        { order: { last_confirmed_at: "DESC" }, take: 10 }
      )
    } catch {
      customerPreferences = []
    }
  }

  res.json({
    conversation,
    customer_preferences: customerPreferences.map((p) => ({
      expires_at: p.expires_at,
      preference_type: p.preference_type,
      status: p.status,
      value: p.value,
    })),
    customer_profile: {
      channel: conversation.channel,
      customer_tier: typeof metadata.customer_tier === "string" ? metadata.customer_tier : null,
      email: typeof metadata.customer_email === "string" ? metadata.customer_email : null,
      name: customerName,
      orders_count: typeof metadata.orders_count === "number" ? metadata.orders_count : null,
      phone: typeof metadata.customer_phone === "string" ? metadata.customer_phone : null,
      shipping_city: typeof metadata.shipping_city === "string" ? metadata.shipping_city : null,
    },
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
