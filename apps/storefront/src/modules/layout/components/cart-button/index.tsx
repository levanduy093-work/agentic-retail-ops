import { retrieveCart } from "@lib/data/cart"
import CartDropdown from "../cart-dropdown"
import { getDictionary } from "@lib/i18n"

export default async function CartButton() {
  const cart = await retrieveCart().catch(() => null)
  const dict = await getDictionary()

  return <CartDropdown cart={cart} dict={dict} />
}
