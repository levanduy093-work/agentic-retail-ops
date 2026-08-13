export const CHANNEL_PRINCIPAL_ROLES = ["OWNER", "CUSTOMER"] as const

export type ChannelPrincipalRole =
  (typeof CHANNEL_PRINCIPAL_ROLES)[number]

export type ChannelPrincipal = {
  external_user_id: string
  principal_id: string
  role: ChannelPrincipalRole
}

export function getConversationTopicType(role: ChannelPrincipalRole) {
  return role === "OWNER" ? "OPERATOR_CHAT" : "CUSTOMER_SUPPORT_CHAT"
}

export function isCustomerSupportConversation(input: {
  metadata?: Record<string, unknown> | null
  topic_type: string
}) {
  return (
    input.topic_type === "CUSTOMER_SUPPORT_CHAT" &&
    input.metadata?.principal_role === "CUSTOMER"
  )
}
