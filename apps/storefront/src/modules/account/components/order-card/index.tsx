"use client"

import { Badge, Button } from "@modules/common/components/ui"
import { useMemo } from "react"
import { useParams } from "next/navigation"

import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "@lib/i18n/client"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

const OrderCard = ({ order }: OrderCardProps) => {
  const t = useTranslation()
  const { locale } = useParams<{ locale?: string }>()
  const isVi = locale === "vi"

  const payment = order.payment_collections?.[0]?.payments?.[0]
  const isPaid = order.payment_status === "captured" || Boolean(payment?.captured_at)

  const numberOfLines = useMemo(() => {
    return (
      order.items?.reduce((acc, item) => {
        return acc + item.quantity
      }, 0) ?? 0
    )
  }, [order])

  const numberOfProducts = useMemo(() => {
    return order.items?.length ?? 0
  }, [order])

  return (
    <div className="bg-white flex flex-col" data-testid="order-card">
      <div className="flex items-center justify-between mb-1">
        <div className="uppercase text-large-semi">
          #<span data-testid="order-display-id">{order.display_id}</span>
        </div>
        <Badge size="small" color={isPaid ? "green" : "orange"}>
          {isPaid
            ? (isVi ? "Đã thanh toán" : "Paid")
            : (isVi ? "Chưa thanh toán" : "Pending Payment")}
        </Badge>
      </div>

      <div className="flex items-center divide-x divide-gray-200 text-small-regular text-ui-fg-base">
        <span className="pr-2" data-testid="order-created-at">
          {new Date(order.created_at).toLocaleDateString(isVi ? "vi-VN" : "en-US")}
        </span>
        <span className="px-2 font-medium" data-testid="order-amount">
          {convertToLocale({
            amount: order.total,
            currency_code: order.currency_code,
          })}
        </span>
        <span className="pl-2">{`${numberOfLines} ${
          numberOfLines > 1 ? t("account.items") : t("account.item")
        }`}</span>
      </div>

      <div className="grid grid-cols-2 small:grid-cols-4 gap-4 my-4">
        {order.items?.slice(0, 3).map((i) => {
          return (
            <div
              key={i.id}
              className="flex flex-col gap-y-2"
              data-testid="order-item"
            >
              <Thumbnail thumbnail={i.thumbnail} images={[]} size="full" />
              <div className="flex items-center text-small-regular text-ui-fg-base">
                <span
                  className="text-ui-fg-base font-semibold truncate"
                  data-testid="item-title"
                >
                  {i.title}
                </span>
                <span className="ml-2">x</span>
                <span data-testid="item-quantity">{i.quantity}</span>
              </div>
            </div>
          )
        })}
        {numberOfProducts > 4 && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <span className="text-small-regular text-ui-fg-base">
              + {numberOfLines - 4}
            </span>
            <span className="text-small-regular text-ui-fg-base">{t("account.more")}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {!isPaid && (
          <LocalizedClientLink href={`/account/orders/details/${order.id}?pay=true`}>
            <Button
              className="rounded-full bg-[#174b3d] hover:bg-[#103a2f] text-white text-xs px-4 py-2 shadow-xs transition"
            >
              {isVi ? "Thanh toán ngay" : "Pay Now"}
            </Button>
          </LocalizedClientLink>
        )}
        <LocalizedClientLink href={`/account/orders/details/${order.id}`}>
          <Button data-testid="order-details-link" variant="secondary">
            {t("account.see_details")}
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderCard

