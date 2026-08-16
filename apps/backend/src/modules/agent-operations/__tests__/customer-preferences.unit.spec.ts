import {
  CUSTOMER_PREFERENCE_EXPIRY_DAYS,
  extractExplicitCustomerPreferences,
  formatCustomerProfilePreferences,
} from "../customer-preferences"

describe("customer preferences", () => {
  it("stores only an explicitly stated size as a long-term preference", () => {
    expect(
      extractExplicitCustomerPreferences(
        "Mình muốn áo thun size M khoảng 300 nghìn"
      )
    ).toEqual([
      { preference_type: "SIZE", status: "CUSTOMER_STATED", value: "M" },
    ])
    expect(extractExplicitCustomerPreferences("Mình xem áo khoác ạ")).toEqual(
      []
    )
  })

  it("marks an explicit reaffirmation as confirmed", () => {
    expect(extractExplicitCustomerPreferences("Vẫn size M nhé")).toEqual([
      { preference_type: "SIZE", status: "CONFIRMED", value: "M" },
    ])
    expect(CUSTOMER_PREFERENCE_EXPIRY_DAYS.CONFIRMED).toBeGreaterThan(
      CUSTOMER_PREFERENCE_EXPIRY_DAYS.CUSTOMER_STATED
    )
  })

  it("formats preference metadata without product, price, stock, or policy facts", () => {
    const values = formatCustomerProfilePreferences([
      {
        expires_at: new Date("2027-02-16T00:00:00.000Z"),
        preference_type: "SIZE",
        status: "CONFIRMED",
        value: "M",
      },
    ])

    expect(values.join(" ")).toContain("Size M")
    expect(values.join(" ")).not.toContain("áo")
  })
})
