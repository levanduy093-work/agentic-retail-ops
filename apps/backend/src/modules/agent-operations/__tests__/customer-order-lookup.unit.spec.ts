import {
  shouldReadCustomerFulfillment,
  shouldReadCustomerPayment,
} from "../customer-order-lookup"

describe("customer order lookup tool selection", () => {
  it("uses the fulfillment tool only for an explicit tracking question", () => {
    expect(shouldReadCustomerFulfillment("Đơn #42 của tôi đang ở đâu?")).toBe(
      true
    )
    expect(shouldReadCustomerFulfillment("Đơn #42 đã tạo chưa?")).toBe(false)
  })

  it("uses the payment tool only for an explicit payment question", () => {
    expect(shouldReadCustomerPayment("Đơn #42 đã thanh toán chưa?")).toBe(
      true
    )
    expect(shouldReadCustomerPayment("Đơn #42 đang giao chưa?")).toBe(false)
  })
})
