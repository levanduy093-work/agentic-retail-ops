import {
  evaluateDefectSeverity,
  extractVisualKeywordsFromDescription,
  isCustomerVisionReviewEnabled,
  selectVisionImageUrls,
  VisionDefectAnalysisOutput,
  VisionProductSearchOutput,
} from "../customer-vision-processor"

describe("customer vision processor", () => {
  it("extracts garment types and colors into focused search keywords", () => {
    const extracted = extractVisualKeywordsFromDescription(
      "Mẫu đầm hoa nhí màu be dáng xòe này shop có không"
    )

    expect(extracted.garment).toBe("đầm")
    expect(extracted.colors).toContain("be")
    expect(extracted.keywords).toContain("đầm be")
  })

  it("evaluates defect severity and return eligibility", () => {
    const torn = evaluateDefectSeverity("TORN_STITCH")
    expect(torn.eligible_for_return).toBe(true)
    expect(torn.severity).toBe("HIGH")

    const none = evaluateDefectSeverity("NONE")
    expect(none.eligible_for_return).toBe(false)
    expect(none.severity).toBe("LOW")
  })

  it("samples a long image message without hiding any images from staff", () => {
    expect(
      selectVisionImageUrls(["first", "second", "middle", "fourth", "last"])
    ).toEqual(["first", "middle", "last"])
  })

  it("keeps vision review disabled until it is explicitly enabled", () => {
    expect(isCustomerVisionReviewEnabled()).toBe(false)
    expect(isCustomerVisionReviewEnabled("false")).toBe(false)
    expect(isCustomerVisionReviewEnabled("true")).toBe(true)
  })

  it("validates structured vision schemas", () => {
    expect(
      VisionProductSearchOutput.parse({
        dominant_colors: ["đen", "trắng"],
        garment_type: "áo polo",
        pattern_style: "kẻ sọc",
        search_keywords: "áo polo đen trắng kẻ sọc",
      })
    ).toBeDefined()

    expect(
      VisionDefectAnalysisOutput.parse({
        defect_type: "TORN_STITCH",
        description: "Rách đường may ở nách áo",
        eligible_for_return: true,
        severity: "HIGH",
      })
    ).toBeDefined()
  })
})
