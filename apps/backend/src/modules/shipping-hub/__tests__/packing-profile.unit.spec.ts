import { buildPackingPlan } from "../packing-profile"

describe("buildPackingPlan", () => {
  it("adds packaging weight once per box and selects the smallest fitting box", () => {
    const packages = buildPackingPlan([
      { quantity: 1, weight: 260, length: 24, width: 18, height: 4 },
    ])

    expect(packages).toEqual([
      expect.objectContaining({
        box_code: "S",
        weight: 340,
      }),
    ])
  })

  it("splits a cart when it reaches the configured item limit", () => {
    const packages = buildPackingPlan([
      { quantity: 6, weight: 200, length: 10, width: 8, height: 2 },
    ])

    expect(packages).toHaveLength(2)
    expect(packages.map((parcel) => parcel.item_count)).toEqual([5, 1])
    expect(packages.reduce((total, parcel) => total + parcel.weight, 0)).toBe(1360)
  })
})
