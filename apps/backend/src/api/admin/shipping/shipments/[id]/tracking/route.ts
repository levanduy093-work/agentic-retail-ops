import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GhnClient } from "../../../../../../modules/ghn-fulfillment/ghn-client"
import { getGhnSettings } from "../../../../../../modules/shipping-hub/ghn-connection"

type FulfillmentData = {
  data?: Record<string, unknown> | null
  id: string
  provider_id?: string | null
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "provider_id", "data"],
    filters: { id: req.params.id },
  })
  const fulfillment = (data as FulfillmentData[])[0]

  if (!fulfillment) {
    res.status(404).json({ message: "Không tìm thấy fulfillment." })
    return
  }

  if (fulfillment.provider_id !== "ghn_ghn") {
    res.status(400).json({ message: "Fulfillment này không dùng GHN." })
    return
  }

  const trackingNumber =
    (fulfillment.data?.ghn_order_code as string | undefined) ||
    (fulfillment.data?.tracking_number as string | undefined)

  if (!trackingNumber) {
    res.status(400).json({ message: "Fulfillment chưa có mã vận đơn GHN." })
    return
  }

  const settings = await getGhnSettings(req.scope)
  const fulfillmentEnvironment = fulfillment.data?.ghn_environment

  if (
    fulfillmentEnvironment &&
    fulfillmentEnvironment !== settings.environment
  ) {
    res.status(409).json({
      message:
        "Môi trường GHN hiện tại khác môi trường đã tạo vận đơn. Chuyển cấu hình carrier về đúng môi trường trước khi theo dõi.",
    })
    return
  }

  const client = new GhnClient({
    apiToken: settings.api_token,
    baseUrl: settings.base_url,
    clientId: settings.client_id,
    environment: settings.environment,
    shopId: settings.shop_id,
  })
  const shipment = await client.getOrderDetail(trackingNumber)

  res.json({
    environment: settings.environment,
    status: shipment.status,
    status_name: shipment.status_name,
    tracking_number: shipment.order_code,
  })
}
