"use client"

import { Heading } from "@modules/common/components/ui"

import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "@lib/i18n/client"

const CheckoutSummary = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const t = useTranslation()

  return (
    <div className="sticky top-28 flex flex-col-reverse gap-y-8 small:flex-col">
      <div className="flex w-full flex-col">
        <Divider className="my-6 small:hidden" />
        <Heading
          level="h2"
          className="flex flex-row items-baseline text-2xl tracking-[-0.04em] text-[#12231d]"
        >
          {t("checkout.in_your_cart")}
        </Heading>
        <Divider className="my-6" />
        <CartTotals totals={cart} />
        <ItemsPreviewTemplate cart={cart} />
        <div className="my-6">
          <DiscountCode cart={cart} />
        </div>
      </div>
    </div>
  )
}

export default CheckoutSummary
