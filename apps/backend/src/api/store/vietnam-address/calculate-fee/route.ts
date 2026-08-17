import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GhnClient } from "../../../../modules/ghn-fulfillment/ghn-client"
import { getGhnSettings } from "../../../../modules/shipping-hub/ghn-connection"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as {
    to_district_id: number
    to_ward_code?: string
    weight?: number
    cart_id?: string
    service_type_id?: number
    insurance_value?: number
  }

  if (!body?.to_district_id) {
    res.status(400).json({ message: "to_district_id is required" })
    return
  }

  const settings = await getGhnSettings(req.scope)
  const fromDistrictId = settings.sender_district_id || 1442
  const toDistrictId = Number(body.to_district_id)
  let weight = body.weight || settings.default_weight || 300

  if (body.cart_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "items.quantity", "items.weight", "items.variant.weight"],
      filters: { id: body.cart_id },
    })
    const cart = carts[0] as
      | {
          items?: Array<{
            quantity?: number | null
            weight?: number | null
            variant?: { weight?: number | null } | null
          }>
        }
      | undefined
    const cartWeight = (cart?.items ?? []).reduce((total, item) => {
      const itemWeight = item.variant?.weight || item.weight || settings.default_weight
      return total + itemWeight * (item.quantity || 1)
    }, 0)

    if (cartWeight > 0) {
      weight = cartWeight
    }
  }

  try {
    const client = new GhnClient({
      apiToken: settings.api_token,
      baseUrl: settings.base_url,
      clientId: settings.client_id,
      environment: settings.environment,
      shopId: settings.shop_id,
    })

    const standardFee = await client.calculateFee({
      from_district_id: fromDistrictId,
      from_ward_code: settings.sender_ward_code,
      to_district_id: toDistrictId,
      to_ward_code: body.to_ward_code,
      weight,
      length: settings.default_length,
      width: settings.default_width,
      height: settings.default_height,
      service_type_id: 2,
      insurance_value: body.insurance_value || 0,
    })

    res.json({
      success: true,
      from_district_id: fromDistrictId,
      to_district_id: toDistrictId,
      weight,
      standard_fee: standardFee.total,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(502).json({
      message: `GHN could not calculate the shipping fee: ${message}`,
    })
  }
}
