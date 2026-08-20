import { MedusaError } from "@medusajs/framework/utils"

export type CustomerChatConversationSnapshot = {
  channel: string
  metadata?: Record<string, unknown> | null
  topic_type: string
}

/**
 * Keeps customer chat isolation at the boundary where a conversation ID is
 * accepted from a browser. Conversation IDs are opaque references, not proof
 * that the caller may read or continue the conversation.
 */
export function assertCustomerChatConversationOwnership(
  conversation: CustomerChatConversationSnapshot,
  customerId: string
) {
  const metadata = conversation.metadata ?? {}
  const isOwnedByCustomer =
    conversation.channel === "IN_APP" &&
    conversation.topic_type === "CUSTOMER_SUPPORT_CHAT" &&
    metadata.principal_role === "CUSTOMER" &&
    metadata.customer_id === customerId

  if (!isOwnedByCustomer) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This customer account cannot access the requested conversation."
    )
  }
}
