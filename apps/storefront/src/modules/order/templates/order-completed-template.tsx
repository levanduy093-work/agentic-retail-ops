import { Heading } from "@modules/common/components/ui"
import { cookies as nextCookies } from "next/headers"

import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OnboardingCta from "@modules/order/components/onboarding-cta"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import { HttpTypes } from "@medusajs/types"
import { getDictionary } from "@lib/i18n"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()
  const dictionary = await getDictionary()

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"

  return (
    <main className="py-8 small:py-12 min-h-[calc(100vh-64px)]">
      <div className="content-container flex flex-col items-center gap-y-10 max-w-4xl">
        {isOnboarding && <OnboardingCta orderId={order.id} />}
        <section
          className="surface-card flex w-full flex-col gap-6 px-5 py-7 xsmall:px-8 small:px-10 small:py-10"
          data-testid="order-complete-container"
        >
          <Heading
            level="h1"
            className="flex flex-col gap-y-2 text-ui-fg-base text-2xl-regular small:text-3xl-regular"
          >
            <span>{dictionary.order.thank_you}</span>
            <span>{dictionary.order.order_placed_success}</span>
          </Heading>
          <OrderDetails order={order} />
          <Heading level="h2" className="text-2xl-regular">
            {dictionary.cart.summary}
          </Heading>
          <Items order={order} />
          <CartTotals totals={order} />
          <ShippingDetails order={order} />
          <PaymentDetails order={order} />
          <Help />
        </section>
      </div>
    </main>
  )
}
