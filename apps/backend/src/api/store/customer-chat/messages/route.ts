import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { answerCustomerKnowledgeQuestionWorkflow } from "../../../../workflows/agent-operations/answer-customer-knowledge-question"
import { postCustomerChatMessageWorkflow } from "../../../../workflows/agent-operations/post-customer-chat-message"
import { StoreCreateCustomerChatMessageType } from "../validators"

export async function POST(
  req: MedusaRequest<StoreCreateCustomerChatMessageType>,
  res: MedusaResponse
) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  const body = req.validatedBody
  const customerId =
    (req as unknown as { auth_context?: { actor_id?: string } })
      .auth_context?.actor_id || body.customer_id

  // 1. Run workflow to record inbound message and ensure conversation
  const { result } = await postCustomerChatMessageWorkflow(req.scope).run({
    input: {
      client_message_id: body.client_message_id,
      conversation_id: body.conversation_id,
      customer_email: body.customer_email,
      customer_id: customerId,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      locale: body.locale,
      message: body.message,
    },
  })

  // 2. Run answer workflow to trigger AI / Product Advisor reply
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
  }

  res.status(201).json({
    conversation_id: result.conversation.id,
    inbound_message: result.inbound_message,
    response_message: responseMessage,
  })
}
