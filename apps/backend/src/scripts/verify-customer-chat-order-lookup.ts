import assert from "node:assert/strict"
import {
  createCustomersWorkflow,
  createOrderWorkflow,
} from "@medusajs/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { answerCustomerKnowledgeQuestionWorkflow } from "../workflows/agent-operations/answer-customer-knowledge-question"
import { createKnowledgeDocumentWorkflow } from "../workflows/agent-operations/create-knowledge-document"

async function createInboundAndAnswer(input: {
  body: string
  conversation_id: string
  idempotency_key: string
  sender_id: string
  service: AgentOperationsModuleService
  container: ExecArgs["container"]
}) {
  const now = new Date()
  const inbound = await input.service.createAgentMessages({
    body: input.body,
    channel: "IN_APP",
    conversation_id: input.conversation_id,
    direction: "INBOUND",
    idempotency_key: input.idempotency_key,
    message_type: "TEXT",
    occurred_at: now,
    processed_at: now,
    sender_id: input.sender_id,
    sender_type: "customer",
    status: "PROCESSED",
  })
  const answered = await answerCustomerKnowledgeQuestionWorkflow(
    input.container
  ).run({ input: { inbound_message_id: inbound.id } })
  assert.ok(answered.result.response_message_id)
  return input.service.retrieveAgentMessage(answered.result.response_message_id)
}

export default async function verifyCustomerChatOrderLookup({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const verificationId = `customer-chat-order-lookup-${Date.now()}`
  const [{ id: ownerCustomerId }, { id: otherCustomerId }] = (
    await createCustomersWorkflow(container).run({
      input: {
        customersData: [
          {
            email: `${verificationId}-owner@example.com`,
            first_name: "Order",
            last_name: "Owner",
          },
          {
            email: `${verificationId}-other@example.com`,
            first_name: "Other",
            last_name: "Customer",
          },
        ],
      },
    })
  ).result
  const { result: order } = await createOrderWorkflow(container).run({
    input: {
      currency_code: "vnd",
      customer_id: ownerCustomerId,
      items: [
        {
          is_discountable: false,
          is_tax_inclusive: true,
          quantity: 1,
          requires_shipping: false,
          title: "Order lookup verification item",
          unit_price: 99,
        },
      ],
      no_notification: true,
      status: "pending",
    },
  })
  const { result: knowledge } = await createKnowledgeDocumentWorkflow(
    container
  ).run({
    input: {
      citation_locator: `policy://customer-support/order-status/${verificationId}`,
      content:
        "Khi khách hỏi trạng thái đơn hàng, nhân viên cần kiểm tra trạng thái thanh toán và giao hàng trực tiếp trên hệ thống trước khi trả lời.",
      document_key: `customer-chat-order-status-${verificationId}`,
      effective_at: new Date(Date.now() - 60_000).toISOString(),
      locale: "vi",
      owner_id: "customer-chat-order-lookup-verifier",
      scope: "customer_support",
      tenant_id: "default",
      title: "Hướng dẫn tra cứu đơn hàng qua chat",
      version: "1.0.0",
    },
  })
  await approveKnowledgeDocumentWorkflow(container).run({
    input: {
      actor_id: "customer-chat-order-lookup-verifier",
      document_id: knowledge.document.id,
    },
  })

  const existingConnection = (
    await service.listAgentChannelConnections(
      { account_ref: "default-admin", channel: "IN_APP", tenant_id: "default" },
      { take: 1 }
    )
  )[0]
  const connection =
    existingConnection ??
    (await service.createAgentChannelConnections({
      account_ref: "customer-chat-order-lookup-verifier",
      channel: "IN_APP",
      config: { delivery: "customer-chat-order-lookup-verifier" },
      status: "ACTIVE",
      tenant_id: "default",
    }))
  const createConversation = async (customerId: string, suffix: string) => {
    const now = new Date()
    return service.createAgentConversations({
      channel: "IN_APP",
      external_thread_id: `${verificationId}:${suffix}`,
      last_message_at: now,
      metadata: {
        connection_id: connection.id,
        customer_id: customerId,
        customer_identity_verified: true,
        principal_id: customerId,
        principal_role: "CUSTOMER",
        verification: verificationId,
      },
      opened_at: now,
      status: "OPEN",
      tenant_id: "default",
      title: `Customer order lookup verification — ${suffix}`,
      topic_id: `${verificationId}:${suffix}`,
      topic_type: "CUSTOMER_SUPPORT_CHAT",
    })
  }

  const ownerConversation = await createConversation(ownerCustomerId, "owner")
  const orderPrompt = await createInboundAndAnswer({
    body: "Thời gian giao hàng bao lâu vậy sốp?",
    container,
    conversation_id: ownerConversation.id,
    idempotency_key: `${verificationId}:owner:delivery-question`,
    sender_id: ownerCustomerId,
    service,
  })
  const promptStructured = (orderPrompt.structured_content ?? {}) as Record<
    string,
    unknown
  >
  assert.equal(promptStructured.pending_customer_input, "ORDER_REFERENCE")
  assert.match(orderPrompt.body, /mã đơn/iu)

  const ownerOrderAnswer = await createInboundAndAnswer({
    body: `#${order.display_id}`,
    container,
    conversation_id: ownerConversation.id,
    idempotency_key: `${verificationId}:owner:order-reference`,
    sender_id: ownerCustomerId,
    service,
  })
  const ownerStructured = (ownerOrderAnswer.structured_content ?? {}) as Record<
    string,
    unknown
  >
  assert.equal(ownerStructured.grounding_source, "LIVE_ORDER")
  assert.match(ownerOrderAnswer.body, new RegExp(`#${order.display_id}`))
  assert.match(ownerOrderAnswer.body, /thanh toán.*giao hàng/iu)

  const otherConversation = await createConversation(otherCustomerId, "other")
  await createInboundAndAnswer({
    body: "Thời gian giao hàng bao lâu vậy sốp?",
    container,
    conversation_id: otherConversation.id,
    idempotency_key: `${verificationId}:other:delivery-question`,
    sender_id: otherCustomerId,
    service,
  })
  const rejectedOrderAnswer = await createInboundAndAnswer({
    body: `#${order.display_id}`,
    container,
    conversation_id: otherConversation.id,
    idempotency_key: `${verificationId}:other:order-reference`,
    sender_id: otherCustomerId,
    service,
  })
  const rejectedStructured = (rejectedOrderAnswer.structured_content ?? {}) as Record<
    string,
    unknown
  >
  assert.notEqual(rejectedStructured.grounding_source, "LIVE_ORDER")
  assert.doesNotMatch(rejectedOrderAnswer.body, /thanh toán:/iu)
  assert.doesNotMatch(rejectedOrderAnswer.body, /giao hàng:/iu)

  console.log(
    JSON.stringify(
      {
        owner_answer: ownerOrderAnswer.body,
        order_display_id: order.display_id,
        rejected_answer: rejectedOrderAnswer.body,
        status: "CUSTOMER_CHAT_ORDER_LOOKUP_VERIFIED",
      },
      null,
      2
    )
  )
}
