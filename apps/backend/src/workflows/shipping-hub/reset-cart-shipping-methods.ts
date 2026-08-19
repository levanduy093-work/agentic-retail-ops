import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { refreshCartItemsWorkflow } from "@medusajs/core-flows"

type ResetCartShippingMethodsInput = {
  cart_id: string
}

export const removeCartShippingMethodsStep = createStep(
  "remove-cart-shipping-methods",
  async ({ cart_id }: ResetCartShippingMethodsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "shipping_methods.id"],
      filters: { id: cart_id },
    })

    const cart = carts[0]
    if (!cart) {
      return new StepResponse({ removed: 0 }, [])
    }

    const shippingMethodIds = (cart.shipping_methods || []).map((sm: any) => sm.id)
    if (!shippingMethodIds.length) {
      return new StepResponse({ removed: 0 }, [])
    }

    const cartService = container.resolve(Modules.CART)
    await cartService.softDeleteShippingMethods(shippingMethodIds)

    return new StepResponse({ removed: shippingMethodIds.length }, shippingMethodIds)
  },
  async (shippingMethodIds, { container }) => {
    if (!shippingMethodIds?.length) {
      return
    }
    const cartService = container.resolve(Modules.CART)
    await cartService.restoreShippingMethods(shippingMethodIds)
  }
)

export const resetCartShippingMethodsWorkflow = createWorkflow(
  "reset-cart-shipping-methods",
  (input: ResetCartShippingMethodsInput) => {
    const removeResult = removeCartShippingMethodsStep(input)

    refreshCartItemsWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        force_refresh: true,
      },
    })

    return new WorkflowResponse(removeResult)
  }
)
