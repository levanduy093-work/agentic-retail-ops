import { MedusaError } from "@medusajs/framework/utils"
import { buildReservationPlan } from "../ensure-ghn-order-fulfillment"

describe("buildReservationPlan", () => {
  const orderItems = [
    {
      id: "orli_1",
      quantity: 2,
      variant_id: "variant_1",
    },
  ]
  const variants = [
    {
      id: "variant_1",
      manage_inventory: true,
      inventory_items: [
        {
          inventory_item_id: "iitem_1",
          required_quantity: 1,
        },
      ],
    },
  ]

  it("creates the complete missing reservation before fulfillment", () => {
    expect(
      buildReservationPlan({
        existingReservations: [],
        locationId: "sloc_1",
        orderItems,
        variants,
      })
    ).toEqual({
      creates: [
        {
          inventory_item_id: "iitem_1",
          line_item_id: "orli_1",
          location_id: "sloc_1",
          quantity: 2,
        },
      ],
      updates: [],
    })
  })

  it("repairs a short or misplaced reservation before calling GHN", () => {
    expect(
      buildReservationPlan({
        existingReservations: [
          {
            id: "res_1",
            inventory_item_id: "iitem_1",
            line_item_id: "orli_1",
            location_id: "sloc_old",
            quantity: 1,
          },
        ],
        locationId: "sloc_1",
        orderItems,
        variants,
      })
    ).toEqual({
      creates: [],
      updates: [
        {
          id: "res_1",
          location_id: "sloc_1",
          quantity: 2,
        },
      ],
    })
  })

  it("does not reserve inventory for unmanaged variants", () => {
    expect(
      buildReservationPlan({
        existingReservations: [],
        locationId: "sloc_1",
        orderItems,
        variants: [{ ...variants[0], manage_inventory: false }],
      })
    ).toEqual({ creates: [], updates: [] })
  })

  it("stops before carrier creation when reservation state is ambiguous", () => {
    expect(() =>
      buildReservationPlan({
        existingReservations: [
          {
            id: "res_1",
            inventory_item_id: "iitem_1",
            line_item_id: "orli_1",
            location_id: "sloc_1",
            quantity: 1,
          },
          {
            id: "res_2",
            inventory_item_id: "iitem_1",
            line_item_id: "orli_1",
            location_id: "sloc_1",
            quantity: 1,
          },
        ],
        locationId: "sloc_1",
        orderItems,
        variants,
      })
    ).toThrow(MedusaError)
  })
})
