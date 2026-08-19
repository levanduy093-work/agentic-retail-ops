"use client"

import { HttpTypes } from "@medusajs/types"
import { Badge, Text } from "@modules/common/components/ui"
import { useTranslation } from "@lib/i18n/client"
import { useParams } from "next/navigation"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const t = useTranslation()
  const { locale } = useParams<{ locale?: string }>()
  const isVi = locale === "vi"

  const orderDate = new Intl.DateTimeFormat(
    isVi ? "vi-VN" : "en-US",
    {
      dateStyle: "medium",
      timeZone: "Asia/Ho_Chi_Minh",
    }
  ).format(new Date(order.created_at))

  const getFulfillmentStatusInfo = (status: string) => {
    switch (status?.toLowerCase()) {
      case "fulfilled":
        return { label: isVi ? "Đã hoàn tất" : "Fulfilled", color: "green" as const }
      case "not_fulfilled":
        return { label: isVi ? "Chờ xử lý" : "Not Fulfilled", color: "grey" as const }
      case "partially_fulfilled":
        return { label: isVi ? "Đang xử lý một phần" : "Partially Fulfilled", color: "orange" as const }
      case "shipped":
        return { label: isVi ? "Đang giao hàng" : "Shipped", color: "blue" as const }
      case "delivered":
        return { label: isVi ? "Đã giao hàng" : "Delivered", color: "green" as const }
      case "canceled":
        return { label: isVi ? "Đã hủy" : "Canceled", color: "red" as const }
      default:
        return { label: status, color: "grey" as const }
    }
  }

  const getPaymentStatusInfo = (status: string) => {
    switch (status?.toLowerCase()) {
      case "captured":
        return { label: isVi ? "Đã thanh toán" : "Paid", color: "green" as const }
      case "authorized":
      case "not_paid":
      case "awaiting":
      case "pending":
        return { label: isVi ? "Chưa thanh toán" : "Pending Payment", color: "orange" as const }
      case "canceled":
        return { label: isVi ? "Đã hủy" : "Canceled", color: "red" as const }
      case "refunded":
        return { label: isVi ? "Đã hoàn tiền" : "Refunded", color: "grey" as const }
      default:
        return { label: status, color: "grey" as const }
    }
  }

  const isActuallyPaid =
    order.payment_status === "captured" ||
    Boolean(order.payment_collections?.[0]?.payments?.[0]?.captured_at) ||
    order.payment_collections?.[0]?.status === "completed"

  const fulfillmentInfo = getFulfillmentStatusInfo(order.fulfillment_status)
  const paymentInfo = isActuallyPaid
    ? { label: isVi ? "Đã thanh toán" : "Paid", color: "green" as const }
    : getPaymentStatusInfo(order.payment_status)

  return (
    <div>
      <Text>
        {t("order.confirmation_sent")}{" "}
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
        <span data-testid="order-date">{orderDate}</span>
      </Text>
      <Text className="mt-2 text-ui-fg-interactive">
        {t("account.order_number")}: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      {showStatus && (
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-small-regular text-ui-fg-muted">
              {isVi ? "Trạng thái đơn hàng:" : "Order status:"}
            </span>
            <Badge size="small" color={fulfillmentInfo.color} data-testid="order-status">
              {fulfillmentInfo.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-small-regular text-ui-fg-muted">
              {isVi ? "Trạng thái thanh toán:" : "Payment status:"}
            </span>
            <Badge size="small" color={paymentInfo.color} data-testid="order-payment-status">
              {paymentInfo.label}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderDetails

