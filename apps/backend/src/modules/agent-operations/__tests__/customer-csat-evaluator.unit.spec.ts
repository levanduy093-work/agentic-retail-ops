import {
  CSATEvaluationOutput,
  evaluateConversationQuality,
} from "../customer-csat-evaluator"

describe("customer csat evaluator", () => {
  it("scores warm, grounded and proactive fashion advisory conversations highly", () => {
    const score = evaluateConversationQuality(
      "Tư vấn áo phông đi chơi cho mình",
      "Dạ mẫu áo phông Cotton này mặc đi chơi siêu xinh nè bạn ơi! Bạn thích gam màu sáng hay tối để mình chọn thêm nhé?",
      true
    )

    expect(score.politeness_score).toBe(10)
    expect(score.sales_proactiveness_score).toBe(9)
    expect(score.overall_csat_score).toBeGreaterThanOrEqual(9.0)
    expect(score.feedback_summary).toContain("xuất sắc")
  })

  it("identifies robotic responses and docks politeness points", () => {
    const score = evaluateConversationQuality(
      "Shop có giao hàng nhanh không",
      "Không hỗ trợ yêu cầu này.",
      false
    )

    expect(score.politeness_score).toBe(5)
    expect(score.overall_csat_score).toBeLessThan(7.0)
  })

  it("validates the structured CSAT output schema", () => {
    const parsed = CSATEvaluationOutput.parse({
      feedback_summary: "Tốt",
      grounding_relevance_score: 9,
      overall_csat_score: 9.2,
      politeness_score: 10,
      sales_proactiveness_score: 8,
      tool_precision_score: 9,
    })

    expect(parsed.overall_csat_score).toBe(9.2)
  })
})
