import { retrieveCart, syncCartWithDefaultAddressAndShipping } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Cart",
  description: "View your cart",
}

export default async function Cart() {
  let cart = await retrieveCart().catch((error) => {
    console.error(error)
    return notFound()
  })

  const customer = await retrieveCustomer()

  if (cart && customer) {
    cart = (await syncCartWithDefaultAddressAndShipping(cart, customer).catch(() => cart)) || cart
  }

  return <CartTemplate cart={cart} customer={customer} />
}
