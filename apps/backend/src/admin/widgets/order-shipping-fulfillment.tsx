import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, StatusBadge, Text } from "@medusajs/ui"
import { DetailWidgetProps } from "@medusajs/framework/types"
import { Link } from "react-router-dom"
import { TruckIcon } from "../lib/icons"

type CarrierFulfillmentData = {
  ghn_current_status?: string
  ghn_order_code?: string
  ghn_print_url?: string
  tracking_number?: string
}

type AdminOrderShippingData = {
  fulfillments?: Array<{ data?: CarrierFulfillmentData | null }>
}

const OrderShippingFulfillmentWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrderShippingData>) => {
  const fulfillment = (order.fulfillments || []).find((candidate) => {
    const data = candidate.data as CarrierFulfillmentData | undefined
    return Boolean(data?.tracking_number || data?.ghn_order_code)
  })
  const data = fulfillment?.data as CarrierFulfillmentData | undefined
  const trackingNumber = data?.tracking_number || data?.ghn_order_code

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-3">
          <TruckIcon className="text-ui-fg-interactive" />
          <div>
            <Text size="small" weight="plus">Vận chuyển</Text>
            <Text size="small" className="text-ui-fg-subtle">Fulfillment được tạo theo shipping option khách đã chọn.</Text>
          </div>
        </div>
        <Button asChild size="small" variant="transparent"><Link to="/shipping">Mở trung tâm</Link></Button>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {trackingNumber ? (
          <div className="flex items-center justify-between gap-x-4">
            <div>
              <Text size="small" className="text-ui-fg-subtle">Mã vận đơn</Text>
              <Text size="small" weight="plus">{trackingNumber}</Text>
            </div>
            <StatusBadge color="orange">{data?.ghn_current_status || "Đã tạo"}</StatusBadge>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-x-4">
            <Text size="small" className="text-ui-fg-subtle">Chưa có vận đơn. Hãy dùng thao tác xuất kho mặc định của Medusa để tạo fulfillment một lần, rồi carrier sẽ tạo vận đơn.</Text>
            <Badge color="grey">Chờ xuất kho</Badge>
          </div>
        )}
        {data?.ghn_print_url && <Button asChild size="small" variant="secondary"><a href={data.ghn_print_url} target="_blank" rel="noreferrer">In nhãn</a></Button>}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderShippingFulfillmentWidget
