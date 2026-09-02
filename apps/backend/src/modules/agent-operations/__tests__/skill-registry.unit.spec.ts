import {
  getPlatformSkillDefinition,
  PLATFORM_SKILL_CATALOG,
} from "../skill-registry"

describe("platform skill registry", () => {
  it("exposes natural-language skills with constrained tool allowlists", () => {
    expect(PLATFORM_SKILL_CATALOG).toHaveLength(3)

    for (const skill of PLATFORM_SKILL_CATALOG) {
      expect(skill.instructions.length).toBeGreaterThan(30)
      expect(skill.eligible_tool_names.length).toBeGreaterThan(0)
      expect(skill.instructions).toContain("Dùng khi")
    }
  })

  it("resolves only an exact platform skill version", () => {
    expect(getPlatformSkillDefinition("catalog-advisor", "1.0.0")?.name).toBe(
      "Tư vấn sản phẩm từ catalog"
    )
    expect(getPlatformSkillDefinition("catalog-advisor", "2.0.0")).toBeNull()
    expect(getPlatformSkillDefinition("unknown", "1.0.0")).toBeNull()
  })
})
