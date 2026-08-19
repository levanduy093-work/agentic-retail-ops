import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resetCartShippingMethodsWorkflow } from "../../../../../../workflows/shipping-hub/reset-cart-shipping-methods"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  if (!cartId) {
    res.status(400).json({ message: "Cart ID is required" })
    return
  }

  await resetCartShippingMethodsWorkflow(req.scope).run({
    input: { cart_id: cartId },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: updatedCarts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "total",
      "subtotal",
      "shipping_total",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.amount",
    ],
    filters: { id: cartId },
  })

  res.status(200).json({ cart: updatedCarts[0] })
}
