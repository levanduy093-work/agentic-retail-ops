import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { assertCustomerChatConversationOwnership } from "../../../../../modules/agent-operations/customer-chat-ownership"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  const conversation = await service.retrieveAgentConversation(req.params.id)
  assertCustomerChatConversationOwnership(
    conversation,
    req.auth_context.actor_id
  )
  const messages = await service.listAgentMessages(
    { conversation_id: conversation.id },
    { order: { occurred_at: "ASC" }, take: 100 }
  )

  res.status(200).json({
    conversation: {
      channel: conversation.channel,
      id: conversation.id,
      last_message_at: conversation.last_message_at,
      status: conversation.status,
      title: conversation.title,
    },
    messages: messages.map((m) => ({
      body: m.body,
      channel: m.channel,
      direction: m.direction,
      id: m.id,
      message_type: m.message_type,
      occurred_at: m.occurred_at,
      image_attachments: (
        m.structured_content as Record<string, unknown> | null
      )?.image_attachments ?? [],
      product_media: (
        m.structured_content as Record<string, unknown> | null
      )?.product_media ?? [],
      sender_id: m.sender_id,
      sender_type: m.sender_type,
      status: m.status,
    })),
  })
}
