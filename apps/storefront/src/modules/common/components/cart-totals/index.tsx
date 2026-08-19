"use client"

import { convertToLocale } from "@lib/util/money"
import React from "react"
import { useTranslation } from "@lib/i18n/client"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_total?: number | null
    item_subtotal?: number | null
    shipping_total?: number | null
    shipping_subtotal?: number | null
    discount_total?: number | null
    discount_subtotal?: number | null
    shipping_methods?: Array<unknown> | null
  }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const t = useTranslation()
  const {
    currency_code,
    total,
    item_total,
    item_subtotal,
    shipping_total,
    shipping_subtotal,
    discount_total,
    discount_subtotal,
    shipping_methods,
  } = totals

  const hasShippingMethods =
    Array.isArray(shipping_methods) && shipping_methods.length > 0
  const isShippingConfirmed =
    shipping_methods !== undefined
      ? hasShippingMethods
      : shipping_total != null && shipping_total > 0

  const shippingAmount = isShippingConfirmed
    ? (shipping_total ?? shipping_subtotal ?? 0)
    : 0
  const discountAmount = discount_total ?? discount_subtotal ?? 0
  const itemAmount =
    item_total ??
    item_subtotal ??
    (total != null
      ? Math.max(0, total + discountAmount - shippingAmount)
      : 0)

  const finalTotal = isShippingConfirmed
    ? (total ?? Math.max(0, itemAmount - discountAmount + shippingAmount))
    : Math.max(0, itemAmount - discountAmount)

  return (
    <div>
      <div className="flex flex-col gap-y-2 txt-medium text-ui-fg-subtle ">
        <div className="flex items-center justify-between">
          <span>{t("cart.subtotal")}</span>
          <span data-testid="cart-subtotal" data-value={itemAmount}>
            {convertToLocale({ amount: itemAmount, currency_code })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t("common.shipping")}</span>
          <span data-testid="cart-shipping" data-value={shippingAmount}>
            {isShippingConfirmed ? (
              shippingAmount === 0 ? (
                <span className="text-ui-fg-interactive">{t("common.free")}</span>
              ) : (
                convertToLocale({ amount: shippingAmount, currency_code })
              )
            ) : (
              <span className="text-ui-fg-muted italic">
                {t("common.calculated_at_checkout")}
              </span>
            )}
          </span>
        </div>
        {!!discountAmount && (
          <div className="flex items-center justify-between">
            <span>{t("common.discount")}</span>
            <span
              className="text-ui-fg-interactive"
              data-testid="cart-discount"
              data-value={discountAmount}
            >
              -{" "}
              {convertToLocale({
                amount: discountAmount,
                currency_code,
              })}
            </span>
          </div>
        )}
      </div>
      <div className="h-px w-full border-b border-gray-200 my-4" />
      <div className="flex items-center justify-between text-ui-fg-base mb-2 txt-medium ">
        <span>{t("common.total")}</span>
        <span
          className="txt-xlarge-plus"
          data-testid="cart-total"
          data-value={finalTotal}
        >
          {convertToLocale({ amount: finalTotal, currency_code })}
        </span>
      </div>
      <div className="h-px w-full border-b border-gray-200 mt-4" />
    </div>
  )
}

export default CartTotals
