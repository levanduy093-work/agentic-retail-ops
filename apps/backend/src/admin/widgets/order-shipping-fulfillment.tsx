import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, StatusBadge, Text } from "@medusajs/ui"
import { DetailWidgetProps } from "@medusajs/framework/types"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { TruckIcon } from "../lib/icons"

type CarrierFulfillmentData = {
  carrier_code?: string
  carrier_name?: string
  ghn_current_status?: string
  ghn_order_code?: string
  ghn_print_url?: string
  label_url?: string
  tracking_number?: string
  tracking_url?: string
}

type AdminOrderShippingData = {
  fulfillments?: Array<{
    data?: CarrierFulfillmentData | null
    id: string
  }>
}

const OrderShippingFulfillmentWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrderShippingData>) => {
  const { t } = useTranslation()
  const fulfillment = (order.fulfillments || []).find((candidate) => {
    const data = candidate.data as CarrierFulfillmentData | undefined
    return Boolean(
      data?.tracking_number ||
        data?.ghn_order_code
    )
  })
  const data = fulfillment?.data as CarrierFulfillmentData | undefined
  const trackingNumber = data?.tracking_number || data?.ghn_order_code
  const status = data?.ghn_current_status || t("orderShippingWidget.created")
  const carrierName =
    data?.carrier_name ||
    (data?.ghn_order_code ? "Giao Hàng Nhanh" : "Carrier")
  const printUrl = data?.label_url || data?.ghn_print_url
  const generatedPrintUrl =
    trackingNumber && data?.ghn_order_code
      ? `/admin/shipping/shipments/${fulfillment?.id}/label`
      : printUrl
  const trackingUrl = data?.tracking_url

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-3">
          <TruckIcon className="text-ui-fg-interactive" />
          <div>
            <Text size="small" weight="plus">
              {t("orderShippingWidget.title", { carrierName })}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              {t("orderShippingWidget.subtitle")}
            </Text>
          </div>
        </div>
        <Button asChild size="small" variant="transparent">
          <Link to="/shipping">{t("orderShippingWidget.openHub")}</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {trackingNumber ? (
          <div className="flex items-center justify-between gap-x-4">
            <div>
              <Text size="small" className="text-ui-fg-subtle">
                {t("orderShippingWidget.trackingNumber")}
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
              {t("orderShippingWidget.noFulfillment")}
            </Text>
            <Badge color="grey">{t("orderShippingWidget.waitingFulfillment")}</Badge>
          </div>
        )}
        <div className="flex gap-x-2">
          {trackingUrl && (
            <Button asChild size="small" variant="secondary">
              <a href={trackingUrl} target="_blank" rel="noreferrer">
                {t("orderShippingWidget.track")}
              </a>
            </Button>
          )}
          {generatedPrintUrl && (
            <Button asChild size="small" variant="secondary">
              <a href={generatedPrintUrl} target="_blank" rel="noreferrer">
                {t("orderShippingWidget.printLabel")}
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
