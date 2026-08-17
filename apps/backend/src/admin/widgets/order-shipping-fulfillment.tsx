import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, StatusBadge, Text } from "@medusajs/ui"
import { DetailWidgetProps } from "@medusajs/framework/types"
import { Link } from "react-router-dom"
import { TruckIcon } from "../lib/icons"

type CarrierFulfillmentData = {
  carrier_code?: string
  carrier_name?: string
  ghn_current_status?: string
  ghn_order_code?: string
  ghn_print_url?: string
  ghtk_current_status?: string
  ghtk_label_id?: string
  ghtk_print_url?: string
  ghtk_tracking_url?: string
  label_url?: string
  tracking_number?: string
  tracking_url?: string
}

type AdminOrderShippingData = {
  fulfillments?: Array<{ data?: CarrierFulfillmentData | null }>
}

const OrderShippingFulfillmentWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrderShippingData>) => {
  const fulfillment = (order.fulfillments || []).find((candidate) => {
    const data = candidate.data as CarrierFulfillmentData | undefined
    return Boolean(
      data?.tracking_number ||
        data?.ghn_order_code ||
        data?.ghtk_label_id
    )
  })
  const data = fulfillment?.data as CarrierFulfillmentData | undefined
  const trackingNumber =
    data?.tracking_number || data?.ghtk_label_id || data?.ghn_order_code
  const status =
    data?.ghtk_current_status || data?.ghn_current_status || "Đã tạo"
  const carrierName =
    data?.carrier_name ||
    (data?.ghtk_label_id ? "Giao Hàng Tiết Kiệm" : data?.ghn_order_code ? "Giao Hàng Nhanh" : "Carrier")
  const printUrl = data?.label_url || data?.ghtk_print_url || data?.ghn_print_url
  const trackingUrl = data?.tracking_url || data?.ghtk_tracking_url

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-3">
          <TruckIcon className="text-ui-fg-interactive" />
          <div>
            <Text size="small" weight="plus">
              Vận chuyển ({carrierName})
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              Fulfillment được tạo tự động theo carrier khách đã chọn khi đặt hàng.
            </Text>
          </div>
        </div>
        <Button asChild size="small" variant="transparent">
          <Link to="/shipping">Mở trung tâm</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {trackingNumber ? (
          <div className="flex items-center justify-between gap-x-4">
            <div>
              <Text size="small" className="text-ui-fg-subtle">
                Mã vận đơn
              </Text>
              <Text size="small" weight="plus">
                {trackingNumber}
              </Text>
            </div>
            <StatusBadge color="orange">{status}</StatusBadge>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-x-4">
            <Text size="small" className="text-ui-fg-subtle">
              Chưa có vận đơn. Hãy dùng thao tác xuất kho mặc định của Medusa để
              tạo fulfillment một lần, rồi carrier sẽ tạo vận đơn.
            </Text>
            <Badge color="grey">Chờ xuất kho</Badge>
          </div>
        )}
        <div className="flex gap-x-2">
          {trackingUrl && (
            <Button asChild size="small" variant="secondary">
              <a href={trackingUrl} target="_blank" rel="noreferrer">
                Tra cứu hành trình
              </a>
            </Button>
          )}
          {printUrl && (
            <Button asChild size="small" variant="secondary">
              <a href={printUrl} target="_blank" rel="noreferrer">
                In nhãn bill
              </a>
            </Button>
          )}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderShippingFulfillmentWidget
