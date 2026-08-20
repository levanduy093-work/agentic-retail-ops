import { retrieveCart } from "@lib/data/cart"
import { isCustomerOwnedAgentDraftCart } from "@lib/data/cart-handoff"
import { setCartId } from "@lib/data/cookies"
import { retrieveCustomer } from "@lib/data/customer"
import { redirect } from "next/navigation"

type Props = {
  params: Promise<{
    countryCode: string
    locale: string
  }>
  searchParams: Promise<{
    cart_id?: string
  }>
}

export default async function AgentCartHandoffPage(props: Props) {
  const [{ countryCode, locale }, { cart_id: cartId }] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const cartPath = `/${locale}/${countryCode}/cart`

  if (!cartId?.trim()) {
    redirect(cartPath)
  }

  const handoffPath = `/cart/agent-handoff?cart_id=${encodeURIComponent(cartId)}`
  const customer = await retrieveCustomer()
  if (!customer) {
    redirect(
      `/${locale}/${countryCode}/account?redirectTo=${encodeURIComponent(handoffPath)}`
    )
  }

  const cart = await retrieveCart(
    cartId,
    "id,customer_id,completed_at,metadata"
  )
  if (!isCustomerOwnedAgentDraftCart(cart, customer.id)) {
    redirect(cartPath)
  }

  await setCartId(cart.id)
  redirect(cartPath)
}
