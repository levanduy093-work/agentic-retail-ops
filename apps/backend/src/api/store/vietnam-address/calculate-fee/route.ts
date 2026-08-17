import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GhnClient } from "../../../../modules/ghn-fulfillment/ghn-client"
import { getGhnSettings } from "../../../../modules/shipping-hub/ghn-connection"
import { buildPackingPlan } from "../../../../modules/shipping-hub/packing-profile"

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
  let packages = [] as ReturnType<typeof buildPackingPlan>

  if (body.cart_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "items.quantity",
        "items.weight",
        "items.length",
        "items.width",
        "items.height",
        "items.variant.weight",
        "items.variant.length",
        "items.variant.width",
        "items.variant.height",
      ],
      filters: { id: body.cart_id },
    })
    const cart = carts[0] as
      | {
          items?: Array<{
            quantity?: number | null
            weight?: number | null
            height?: number | null
            length?: number | null
            width?: number | null
            variant?: {
              height?: number | null
              length?: number | null
              weight?: number | null
              width?: number | null
            } | null
          }>
        }
      | undefined
    packages = buildPackingPlan(
      (cart?.items || []).map((item) => ({
        height: item.variant?.height || item.height,
        length: item.variant?.length || item.length,
        quantity: item.quantity,
        weight: item.variant?.weight || item.weight,
        width: item.variant?.width || item.width,
      })),
      settings.packing_profile,
      settings.default_weight
    )
  }

  if (!packages.length) {
    packages = [{
      box_code: "DEFAULT",
      height: settings.default_height,
      item_count: 1,
      length: settings.default_length,
      weight: body.weight || settings.default_weight || 300,
      width: settings.default_width,
    }]
  }

  try {
    const client = new GhnClient({
      apiToken: settings.api_token,
      baseUrl: settings.base_url,
      clientId: settings.client_id,
      environment: settings.environment,
      shopId: settings.shop_id,
    })

    const standardFees = await Promise.all(
      packages.map((parcel) => client.calculateFee({
        from_district_id: fromDistrictId,
        from_ward_code: settings.sender_ward_code,
        to_district_id: toDistrictId,
        to_ward_code: body.to_ward_code,
        weight: parcel.weight,
        length: parcel.length,
        width: parcel.width,
        height: parcel.height,
        service_type_id: 2,
        insurance_value: body.insurance_value || 0,
      }))
    )

    res.json({
      success: true,
      from_district_id: fromDistrictId,
      to_district_id: toDistrictId,
      packages,
      weight: packages.reduce((total, parcel) => total + parcel.weight, 0),
      standard_fee: standardFees.reduce((total, fee) => total + fee.total, 0),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(502).json({
      message: `GHN could not calculate the shipping fee: ${message}`,
    })
  }
}
