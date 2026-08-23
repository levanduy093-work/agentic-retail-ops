import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { answerCustomerKnowledgeQuestionWorkflow } from "../../../../workflows/agent-operations/answer-customer-knowledge-question"
import { postCustomerChatMessageWorkflow } from "../../../../workflows/agent-operations/post-customer-chat-message"
import { refreshConversationMemoryWorkflow } from "../../../../workflows/agent-operations/refresh-conversation-memory"
import { StoreCreateCustomerChatMessageType } from "../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<StoreCreateCustomerChatMessageType>,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  const body = req.validatedBody
  const customer = await req.scope
    .resolve(Modules.CUSTOMER)
    .retrieveCustomer(req.auth_context.actor_id)
  const customerName = [customer.first_name, customer.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")

  // 1. Run workflow to record inbound message and ensure conversation
  const { result } = await postCustomerChatMessageWorkflow(req.scope).run({
    input: {
      client_message_id: body.client_message_id,
      attachment_ids: body.attachment_ids,
      conversation_id: body.conversation_id,
      customer_id: req.auth_context.actor_id,
      customer_email: customer.email ?? undefined,
      customer_name: customerName || undefined,
      customer_phone: customer.phone ?? undefined,
      locale: body.locale,
      message: body.message,
    },
  })

  // Refresh the current-session memory before orchestration so the latest
  // customer turn is available without importing any other conversation.
  try {
    await refreshConversationMemoryWorkflow(req.scope).run({
      input: { conversation_id: result.conversation.id },
    })
  } catch (error) {
    console.error("Error refreshing customer chat memory before answer:", error)
  }

  // Run the governed orchestrator and response pipeline.
  let responseMessage: Record<string, unknown> | null = null
  try {
    const answered = await answerCustomerKnowledgeQuestionWorkflow(req.scope).run({
      input: {
        inbound_message_id: result.inbound_message.id,
      },
    })
    if (answered.result?.response_message_id) {
      responseMessage = await service.retrieveAgentMessage(
        answered.result.response_message_id
      )
    }
  } catch (error) {
    console.error("Error answering customer chat message:", error)
  } finally {
    try {
      await refreshConversationMemoryWorkflow(req.scope).run({
        input: { conversation_id: result.conversation.id },
      })
    } catch (error) {
      console.error("Error refreshing customer chat memory after answer:", error)
    }
  }

  res.status(201).json({
    conversation_id: result.conversation.id,
    inbound_message: result.inbound_message,
    response_message: responseMessage,
  })
}
