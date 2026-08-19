import {
  buildPackingPlan,
  DEFAULT_PACKAGING_PROFILE,
  normalizePackagingProfile,
} from "../packing-profile"

describe("packing-profile & strategy rules", () => {
  describe("normalizePackagingProfile", () => {
    it("returns default profile when passed undefined or empty object", () => {
      const profile = normalizePackagingProfile(undefined)
      expect(profile.strategy).toBe("hybrid_auto")
      expect(profile.packaging_weight).toBe(80)
      expect(profile.bag_packaging_weight).toBe(10)
      expect(profile.bags.length).toBeGreaterThan(0)
      expect(profile.boxes.length).toBeGreaterThan(0)
    })

    it("preserves custom strategy and weights", () => {
      const profile = normalizePackagingProfile({
        strategy: "pe_only",
        packaging_weight: 120,
        bag_packaging_weight: 15,
        max_items_per_package: 3,
        max_weight_per_package: 2000,
        bags: [{ code: "PE-CUSTOM", length: 30, width: 20, max_thickness: 5 }],
        boxes: [{ code: "BOX-CUSTOM", length: 30, width: 20, height: 10 }],
      })

      expect(profile.strategy).toBe("pe_only")
      expect(profile.packaging_weight).toBe(120)
      expect(profile.bag_packaging_weight).toBe(15)
      expect(profile.max_items_per_package).toBe(3)
      expect(profile.bags[0].code).toBe("PE-CUSTOM")
    })
  })

  describe("buildPackingPlan with hybrid_auto strategy", () => {
    it("selects PE bag for small/flat fashion items to minimize dimensional weight", () => {
      // 1 T-shirt: 20x15x2cm, 200g
      const items = [{ length: 20, width: 15, height: 2, quantity: 1, weight: 200 }]
      const plan = buildPackingPlan(items)

      expect(plan).toHaveLength(1)
      expect(plan[0].package_type).toBe("pe_bag")
      expect(plan[0].box_code).toContain("PE")
      // Weight includes 10g PE bag tare weight (200 + 10 = 210g)
      expect(plan[0].weight).toBe(210)
      expect(plan[0].height).toBeLessThanOrEqual(5)
    })

    it("automatically falls back to Carton box when item is too thick/rigid for PE bags", () => {
      // Bulky/tall box: 30x20x15cm, 1200g (height 15cm exceeds PE bag max thickness 8cm)
      const items = [{ length: 30, width: 20, height: 15, quantity: 1, weight: 1200 }]
      const plan = buildPackingPlan(items)

      expect(plan).toHaveLength(1)
      expect(plan[0].package_type).toBe("carton_box")
      // Box tare weight 80g is applied (1200 + 80 = 1280g)
      expect(plan[0].weight).toBe(1280)
    })
  })

  describe("buildPackingPlan with pe_only strategy", () => {
    it("always uses PE bags when matching size", () => {
      const items = [{ length: 22, width: 15, height: 3, quantity: 2, weight: 400 }]
      const plan = buildPackingPlan(items, {
        ...DEFAULT_PACKAGING_PROFILE,
        strategy: "pe_only",
      })

      expect(plan).toHaveLength(1)
      expect(plan[0].package_type).toBe("pe_bag")
    })
  })

  describe("buildPackingPlan with carton_only strategy", () => {
    it("always chooses Carton box even for small items", () => {
      const items = [{ length: 15, width: 10, height: 2, quantity: 1, weight: 150 }]
      const plan = buildPackingPlan(items, {
        ...DEFAULT_PACKAGING_PROFILE,
        strategy: "carton_only",
      })

      expect(plan).toHaveLength(1)
      expect(plan[0].package_type).toBe("carton_box")
      expect(plan[0].box_code).toBe("S")
      expect(plan[0].weight).toBe(150 + 80)
    })
  })

  describe("multi-item grouping and limit handling", () => {
    it("splits into multiple packages when max_items limit is exceeded", () => {
      // 7 items with max_items_per_package = 5 -> should split into 2 packages (5 items + 2 items)
      const items = [{ length: 15, width: 10, height: 2, quantity: 7, weight: 100 }]
      const plan = buildPackingPlan(items, {
        ...DEFAULT_PACKAGING_PROFILE,
        max_items_per_package: 5,
      })

      expect(plan).toHaveLength(2)
      expect(plan[0].item_count).toBe(5)
      expect(plan[1].item_count).toBe(2)
    })
  })
})
