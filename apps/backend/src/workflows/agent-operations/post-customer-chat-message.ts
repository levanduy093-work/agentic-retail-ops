import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { assertCustomerChatConversationOwnership } from "../../modules/agent-operations/customer-chat-ownership"

export type PostCustomerChatMessageInput = {
  attachment_ids?: string[]
  client_message_id?: string
  conversation_id?: string
  customer_email?: string
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  locale?: "en" | "vi"
  message: string
}

export const postCustomerChatMessageStep = createStep(
  "post-customer-chat-message",
  async (input: PostCustomerChatMessageInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const customerId = input.customer_id
    if (!customerId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Customer chat messages require an authenticated customer."
      )
    }
    const now = new Date()
    const attachmentIds = Array.from(new Set(input.attachment_ids ?? []))
    if (attachmentIds.length > 3) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A customer-support message can include at most three images."
      )
    }
    const imageAttachments = await Promise.all(
      attachmentIds.map(async (attachmentId) => {
        const file = await container.resolve(Modules.FILE).retrieveFile(
          attachmentId
        )
        if (!file.url) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "A customer-support attachment is unavailable."
          )
        }
        return { id: file.id, url: file.url }
      })
    )

    const existingConnections = await service.listAgentChannelConnections(
      { account_ref: "default-admin", channel: "IN_APP", tenant_id: "default" },
      { take: 1 }
    )
    const connection =
      existingConnections[0] ??
      (await service.createAgentChannelConnections({
        account_ref: "storefront-chat",
        channel: "IN_APP",
        config: { delivery: "storefront-chat" },
        status: "ACTIVE",
        tenant_id: "default",
      }))

    let conversation: any = null
    if (input.conversation_id) {
      conversation = await service.retrieveAgentConversation(input.conversation_id)
      assertCustomerChatConversationOwnership(conversation, customerId)
    }

    // If no specific conversation was provided, look for existing OPEN conversation for this customer
    if (!conversation && customerId !== "guest") {
      const openConvs = await service.listAgentConversations(
        {
          channel: "IN_APP",
          status: "OPEN",
          topic_type: "CUSTOMER_SUPPORT_CHAT",
        },
        { order: { last_message_at: "DESC" }, take: 10 }
      )
      conversation = openConvs.find(
        (c) =>
          (c.metadata as Record<string, unknown> | null)?.customer_id ===
          customerId
      ) ?? null
    }

    if (!conversation || conversation.status !== "OPEN") {
      const externalThreadId = `storefront-chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const customerDisplay =
        input.customer_name ||
        input.customer_email ||
        (customerId === "guest" ? "Khách vãng lai" : customerId)

      conversation = await service.createAgentConversations({
        channel: "IN_APP",
        external_thread_id: externalThreadId,
        last_message_at: now,
        metadata: {
          connection_id: connection.id,
          customer_email: input.customer_email ?? null,
          customer_id: customerId,
          customer_identity_verified: customerId !== "guest",
          customer_name: input.customer_name ?? null,
          customer_phone: input.customer_phone ?? null,
          principal_id: customerId,
          principal_role: "CUSTOMER",
          storefront: true,
        },
        opened_at: now,
        status: "OPEN",
        tenant_id: "default",
        title: `Khách hàng: ${customerDisplay}`,
        topic_id: externalThreadId,
        topic_type: "CUSTOMER_SUPPORT_CHAT",
      })
    } else {
      // Update customer info on conversation metadata if provided
      if (
        customerId !== "guest" ||
        input.customer_email ||
        input.customer_name ||
        input.customer_phone
      ) {
        const prevMetadata =
          (conversation.metadata as Record<string, unknown> | null) ?? {}
        await service.updateAgentConversations({
          id: conversation.id,
          metadata: {
            ...prevMetadata,
            customer_email:
              input.customer_email ?? prevMetadata.customer_email,
            customer_id: customerId,
            customer_identity_verified: customerId !== "guest",
            customer_name: input.customer_name ?? prevMetadata.customer_name,
            customer_phone:
              input.customer_phone ?? prevMetadata.customer_phone,
          },
        })
      }
    }

    const clientMessageId =
      input.client_message_id || `storefront-msg-${Date.now()}`
    const idempotencyKey = `storefront-inbound:${conversation.id}:${clientMessageId}`

    const inboundMessage = await service.createAgentMessages({
      body: input.message,
      channel: "IN_APP",
      conversation_id: conversation.id,
      direction: "INBOUND",
      idempotency_key: idempotencyKey,
      message_type: "TEXT",
      occurred_at: now,
      sender_id: customerId,
      sender_type: "customer",
      status: "PROCESSED",
      structured_content: {
        client_message_id: clientMessageId,
        customer_email: input.customer_email ?? null,
        customer_name: input.customer_name ?? null,
        image_attachments: imageAttachments,
        locale: input.locale ?? "vi",
      },
    })

    service.broadcastMessageCreated(inboundMessage)
    service.broadcastConversationUpdated(conversation)

    return new StepResponse({
      conversation,
      inbound_message: inboundMessage,
    })
  }
)

export const postCustomerChatMessageWorkflow = createWorkflow(
  "post-customer-chat-message",
  function (input: PostCustomerChatMessageInput) {
    const postResult = postCustomerChatMessageStep(input)
    return new WorkflowResponse(postResult)
  }
)
