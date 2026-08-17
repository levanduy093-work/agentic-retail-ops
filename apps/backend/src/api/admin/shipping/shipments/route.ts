import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SHIPPING_HUB_MODULE } from "../../../../modules/shipping-hub"
import type ShippingHubModuleService from "../../../../modules/shipping-hub/service"

type FulfillmentData = {
  data?: Record<string, unknown> | null
  delivered_at?: Date | null
  id: string
  provider_id?: string | null
  shipped_at?: Date | null
  labels?: Array<{
    label_url?: string | null
    tracking_number?: string | null
    tracking_url?: string | null
  }>
  order?: {
    display_id?: number | null
    id: string
  } | null
  created_at: Date
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const shippingHub = req.scope.resolve<ShippingHubModuleService>(
    SHIPPING_HUB_MODULE
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const carriers = await shippingHub.listShippingCarrierConnections()
  const carrierByProvider = new Map(
    carriers.map((carrier) => [carrier.provider_id, carrier])
  )
  const providerIds = Array.from(carrierByProvider.keys())

  if (!providerIds.length) {
    res.json({ shipments: [] })
    return
  }

  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "provider_id",
      "data",
      "created_at",
      "shipped_at",
      "delivered_at",
      "labels.*",
      "order.id",
      "order.display_id",
    ],
    filters: { provider_id: providerIds },
    pagination: { skip: 0, take: 100 },
  })

  const shipments = (fulfillments as FulfillmentData[]).map((fulfillment) => {
    const carrier = carrierByProvider.get(fulfillment.provider_id || "")
    const data = fulfillment.data ?? {}
    const label = fulfillment.labels?.[0]
    const trackingNumber =
      (data.tracking_number as string | undefined) ||
      (data.ghn_order_code as string | undefined) ||
      label?.tracking_number ||
      null

    return {
      carrier_code: carrier?.code ?? fulfillment.provider_id,
      carrier_name: carrier?.name ?? fulfillment.provider_id,
      created_at: fulfillment.created_at,
      delivered_at: fulfillment.delivered_at,
      fulfillment_id: fulfillment.id,
      label_url:
        (data.ghn_print_url as string | undefined) || label?.label_url || null,
      order_display_id: fulfillment.order?.display_id ?? null,
      order_id: fulfillment.order?.id ?? null,
      environment:
        (data.ghn_environment as "sandbox" | "production" | undefined) ||
        (carrier?.environment === "PRODUCTION" ? "production" : "sandbox"),
      service:
        (data.id as string | undefined) ||
        (data.service_type_id === 1 ? "ghn-fast" : "ghn-standard"),
      shipped_at: fulfillment.shipped_at,
      status: (data.ghn_current_status as string | undefined) ||
        (fulfillment.delivered_at ? "delivered" : fulfillment.shipped_at ? "shipping" : "created"),
      tracking_number: trackingNumber,
      tracking_url:
        (data.ghn_tracking_url as string | undefined) || label?.tracking_url || null,
    }
  })

  res.json({ shipments })
}
