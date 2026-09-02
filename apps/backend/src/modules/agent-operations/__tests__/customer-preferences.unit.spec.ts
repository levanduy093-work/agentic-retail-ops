import {
  extractExplicitCustomerPreferences,
  formatCustomerProfilePreferences,
  resolveCustomerPreferenceStatus,
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
  })

  it("formats preference metadata without product, price, stock, or policy facts", () => {
    const values = formatCustomerProfilePreferences([
      {
        preference_type: "SIZE",
        status: "CONFIRMED",
        value: "M",
      },
    ])

    expect(values.join(" ")).toContain("Size M")
    expect(values.join(" ")).not.toContain("hết hạn")
    expect(values.join(" ")).not.toContain("áo")
  })

  it("replaces a corrected value without inheriting confirmation from the old value", () => {
    expect(
      resolveCustomerPreferenceStatus(
        { status: "CONFIRMED", value: "M" },
        { preference_type: "SIZE", status: "CUSTOMER_STATED", value: "L" }
      )
    ).toBe("CUSTOMER_STATED")
    expect(
      resolveCustomerPreferenceStatus(
        { status: "CONFIRMED", value: "M" },
        { preference_type: "SIZE", status: "CUSTOMER_STATED", value: "M" }
      )
    ).toBe("CONFIRMED")
  })
})
