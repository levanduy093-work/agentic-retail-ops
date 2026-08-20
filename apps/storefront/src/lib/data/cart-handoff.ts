import { HttpTypes } from "@medusajs/types"

export function isCustomerOwnedAgentDraftCart(
  cart: HttpTypes.StoreCart | null,
  customerId: string
): cart is HttpTypes.StoreCart {
  return Boolean(
    cart &&
      cart.customer_id === customerId &&
      !cart.completed_at &&
      cart.metadata?.agent_action_request_id
  )
}
