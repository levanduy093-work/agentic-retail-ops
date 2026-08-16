import {
  extractCustomerOrderDisplayId,
  getVerifiedLinkedCustomerId,
  isAwaitingCustomerOrderReference,
} from "../customer-order-lookup"

describe("customer order lookup guardrails", () => {
  it("accepts an explicit display order reference but not an arbitrary number", () => {
    expect(extractCustomerOrderDisplayId("Mã đơn của em là #123")).toBe(123)
    expect(extractCustomerOrderDisplayId("#456")).toBe(456)
    expect(extractCustomerOrderDisplayId("456")).toBeNull()
    expect(extractCustomerOrderDisplayId("456", true)).toBe(456)
  })

  it("only accepts a bare number after the bot has requested an order reference", () => {
    expect(
      isAwaitingCustomerOrderReference([
        {
          direction: "OUTBOUND",
          structured_content: { pending_customer_input: "ORDER_REFERENCE" },
        },
      ])
    ).toBe(true)
    expect(
      isAwaitingCustomerOrderReference([
        { direction: "OUTBOUND", structured_content: {} },
      ])
    ).toBe(false)
  })

  it("does not treat an unverified chat identifier as a Medusa customer identity", () => {
    expect(
      getVerifiedLinkedCustomerId({
        customer_id: "cus_123",
        principal_role: "CUSTOMER",
      })
    ).toBeNull()
    expect(
      getVerifiedLinkedCustomerId({
        customer_id: "cus_123",
        customer_identity_verified: true,
        principal_role: "CUSTOMER",
      })
    ).toBe("cus_123")
  })
})
