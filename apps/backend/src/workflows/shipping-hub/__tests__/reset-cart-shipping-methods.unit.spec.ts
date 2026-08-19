import { resetCartShippingMethodsWorkflow, removeCartShippingMethodsStep } from "../reset-cart-shipping-methods"

describe("reset-cart-shipping-methods", () => {
  it("exports the workflow and step properly", () => {
    expect(resetCartShippingMethodsWorkflow).toBeDefined()
    expect(removeCartShippingMethodsStep).toBeDefined()
  })
})
