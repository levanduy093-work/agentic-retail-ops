import type { OrderReadOutput } from "./tools/order-tools"

export type CustomerOrderLookup =
  | {
      display_id: number
      status: "FOUND"
      order: OrderReadOutput
    }
  | {
      display_id: number | null
      status: "ACCOUNT_NOT_LINKED" | "NOT_FOUND" | "NOT_OWNER"
    }

export function extractCustomerOrderDisplayId(
  message: string,
  allowBareNumber = false
) {
  const normalized = message.normalize("NFKC").trim()
  const explicit = normalized.match(
    /(?:mã\s*(?:đơn|order)|đơn\s*hàng|order)\s*(?:của\s*(?:em|tôi|mình))?\s*(?:là|:)?\s*#?\s*(\d{1,12})\b/iu
  )
  const hashtag = normalized.match(/(?:^|\s)#(\d{1,12})\b/u)
  const bare = allowBareNumber
    ? normalized.match(/^\s*(\d{1,12})\s*$/u)
    : null
  const candidate = explicit?.[1] ?? hashtag?.[1] ?? bare?.[1]
  if (!candidate) return null

  const displayId = Number(candidate)
  return Number.isSafeInteger(displayId) && displayId > 0 ? displayId : null
}

export function isAwaitingCustomerOrderReference(
  messages: Array<{ direction: string; structured_content?: unknown }>
) {
  const latestOutbound = messages.find(
    (message) => message.direction === "OUTBOUND"
  )
  if (!latestOutbound || !latestOutbound.structured_content) return false

  const structured = latestOutbound.structured_content as Record<string, unknown>
  return structured.pending_customer_input === "ORDER_REFERENCE"
}

export function getVerifiedLinkedCustomerId(metadata: Record<string, unknown>) {
  const customerId = metadata.customer_id
  const principalRole = metadata.principal_role
  const identityVerified = metadata.customer_identity_verified

  return typeof customerId === "string" &&
    customerId.length > 0 &&
    principalRole === "CUSTOMER" &&
    identityVerified === true
    ? customerId
    : null
}
