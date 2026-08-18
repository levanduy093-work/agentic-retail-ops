"use client"

import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"
import { useTranslation } from "@lib/i18n/client"
import { useParams } from "next/navigation"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const t = useTranslation()
  const { locale } = useParams<{ locale?: string }>()
  const orderDate = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-US",
    {
      dateStyle: "medium",
      timeZone: "Asia/Ho_Chi_Minh",
    }
  ).format(new Date(order.created_at))
  const formatStatus = (str: string) => {
    const formatted = str.split("_").join(" ")

    return formatted.slice(0, 1).toUpperCase() + formatted.slice(1)
  }

  return (
    <div>
      <Text>
        {t("order.confirmation_sent")} {" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </Text>
      <Text className="mt-2">
        {t("account.date_placed")}:{" "}
        <span data-testid="order-date">
          {orderDate}
        </span>
      </Text>
      <Text className="mt-2 text-ui-fg-interactive">
        {t("account.order_number")}: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      <div className="flex items-center text-compact-small gap-x-4 mt-4">
        {showStatus && (
          <>
            <Text>
              Order status:{" "}
              <span className="text-ui-fg-subtle " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </Text>
            <Text>
              Payment status:{" "}
              <span
                className="text-ui-fg-subtle "
                sata-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
