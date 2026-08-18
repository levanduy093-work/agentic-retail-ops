"use client"

import { Button, Heading } from "@modules/common/components/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "@lib/i18n/client"

type SummaryProps = {
  cart: HttpTypes.StoreCart
  customer?: HttpTypes.StoreCustomer | null
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  }

  // A GHN fee depends on the current destination and package plan. Re-entering
  // checkout always starts at Delivery so this single authoritative quote is
  // refreshed before the customer can continue to payment.
  return "delivery"
}

const Summary = ({ cart, customer }: SummaryProps) => {
  const t = useTranslation()
  const step = getCheckoutStep(cart)
  const isAuthenticated = Boolean(customer?.id)

  return (
    <div className="flex flex-col gap-y-4">
      <Heading level="h2" className="text-2xl leading-tight tracking-[-0.04em] text-[#12231d]">
        {t("cart.summary")}
      </Heading>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />

      {!isAuthenticated ? (
        <div className="flex flex-col gap-y-3">
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex flex-col gap-y-1">
            <div className="font-semibold text-amber-950 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{t("cart.auth_required_title")}</span>
            </div>
            <p className="text-amber-800/90 leading-relaxed">
              {t("cart.auth_required_desc")}
            </p>
          </div>
          <LocalizedClientLink
            href="/account?redirectTo=/checkout"
            data-testid="checkout-login-button"
          >
            <Button className="h-12 w-full bg-[#12231d] hover:bg-[#1a342b] text-white">
              {t("cart.sign_in_to_checkout")}
            </Button>
          </LocalizedClientLink>
        </div>
      ) : (
        <LocalizedClientLink
          href={"/checkout?step=" + step}
          data-testid="checkout-button"
        >
          <Button className="h-12 w-full bg-[#12231d] hover:bg-[#1a342b] text-white">
            {t("cart.go_to_checkout")}
          </Button>
        </LocalizedClientLink>
      )}
    </div>
  )
}

export default Summary
