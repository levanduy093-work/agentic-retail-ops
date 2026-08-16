import { Metadata } from "next"

import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption } from "@medusajs/types"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"
import NavigationProgress from "@modules/layout/components/navigation-progress"

import CustomerChatWidget from "@modules/customer-chat/components/chat-widget"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

// Customer and cart data come from request cookies, so every route under this
// layout must render per request instead of being mixed with static product pages.
export const dynamic = "force-dynamic"

export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string; locale: string }>
}) {
  const { countryCode, locale } = await props.params
  const [customer, cart] = await Promise.all([
    retrieveCustomer(),
    retrieveCart(),
  ])
  let shippingOptions: StoreCartShippingOption[] = []

  if (cart) {
    const { shipping_options } = await listCartOptions()

    shippingOptions = shipping_options
  }

  return (
    <>
      <NavigationProgress />
      <Nav />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      {cart && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart}
          shippingOptions={shippingOptions}
        />
      )}
      {props.children}
      <CustomerChatWidget
        customer={customer}
        countryCode={countryCode}
        locale={locale}
      />
      <Footer />
    </>
  )
}
