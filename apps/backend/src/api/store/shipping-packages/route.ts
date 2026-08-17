import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getGhnSettings } from "../../../modules/shipping-hub/ghn-connection"
import { buildPackingPlan } from "../../../modules/shipping-hub/packing-profile"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { cart_id } = req.body as { cart_id?: string }
  if (!cart_id) {
    res.status(400).json({ message: "cart_id is required" })
    return
  }

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
    filters: { id: cart_id },
  })
  const cart = carts[0] as { items?: Array<Record<string, any>> } | undefined
  if (!cart) {
    res.status(404).json({ message: "Cart not found" })
    return
  }

  const settings = await getGhnSettings(req.scope)
  const packages = buildPackingPlan(
    (cart.items || []).map((item) => ({
      height: item.variant?.height || item.height,
      length: item.variant?.length || item.length,
      quantity: item.quantity,
      weight: item.variant?.weight || item.weight,
      width: item.variant?.width || item.width,
    })),
    settings.packing_profile,
    settings.default_weight
  )

  res.json({
    packages,
    total_weight: packages.reduce((total, parcel) => total + parcel.weight, 0),
  })
}
