import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  const customerId = req.auth_context.actor_id

  const openConvs = await service.listAgentConversations(
    {
      channel: "IN_APP",
      status: "OPEN",
      topic_type: "CUSTOMER_SUPPORT_CHAT",
    },
    { order: { last_message_at: "DESC" }, take: 20 }
  )

  const activeConversation = openConvs.find(
    (c) =>
      (c.metadata as Record<string, unknown> | null)?.customer_id ===
      customerId
  )

  if (!activeConversation) {
    res.json({
      conversation: null,
      messages: [],
    })
    return
  }

  const rawMessages = await service.listAgentMessages(
    {
      conversation_id: activeConversation.id,
    },
    {
      order: { occurred_at: "ASC" },
      take: 100,
    }
  )

  const messages = rawMessages.map((msg) => ({
    body: msg.body,
    id: msg.id,
    occurred_at:
      msg.occurred_at instanceof Date
        ? msg.occurred_at.toISOString()
        : String(msg.occurred_at),
    product_media: (
      msg.structured_content as Record<string, unknown> | null
    )?.product_media as any,
    image_attachments: (
      msg.structured_content as Record<string, unknown> | null
    )?.image_attachments ?? [],
    sender_type: msg.sender_type,
  }))

  res.json({
    conversation: {
      id: activeConversation.id,
      title: activeConversation.title,
    },
    messages,
  })
}
