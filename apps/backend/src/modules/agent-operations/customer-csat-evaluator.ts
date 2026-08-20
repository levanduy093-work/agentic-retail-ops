import { z } from "@medusajs/framework/zod"

export const CSATEvaluationOutput = z.strictObject({
  feedback_summary: z.string().min(1),
  grounding_relevance_score: z.number().min(1).max(10),
  overall_csat_score: z.number().min(1).max(10),
  politeness_score: z.number().min(1).max(10),
  sales_proactiveness_score: z.number().min(1).max(10),
  tool_precision_score: z.number().min(1).max(10),
})

export type CSATEvaluationOutput = z.infer<typeof CSATEvaluationOutput>

export function evaluateConversationQuality(
  customerMessage: string,
  agentResponse: string,
  hasGroundedData = true
): CSATEvaluationOutput {
  const normResponse = agentResponse.normalize("NFKC").toLowerCase()

  // 1. Politeness score
  let politeness = 7
  if (/(?:dạ|mình|sốp|bạn nhé|ạ|nha|nhé)/iu.test(normResponse)) {
    politeness = 10
  }
  if (/(?:không hỗ trợ|tôi không có quyền|lỗi hệ thống)/iu.test(normResponse)) {
    politeness = 5
  }

  // 2. Tool & Grounding relevance
  const toolPrecision = hasGroundedData ? 10 : 6
  const grounding = hasGroundedData ? 9 : 7

  // 3. Sales proactiveness (asking follow-up question, offering options)
  let salesProactive = 6
  if (/\?|nè\?|ạ\?|nhé\?|không\?|bạn thích|gợi ý/iu.test(normResponse)) {
    salesProactive = 9
  }

  // 4. Overall CSAT (weighted average)
  const overall = Number(
    (
      politeness * 0.3 +
      toolPrecision * 0.25 +
      grounding * 0.25 +
      salesProactive * 0.2
    ).toFixed(1)
  )

  return {
    feedback_summary:
      overall >= 8.5
        ? "Cuộc hội thoại xuất sắc, tự nhiên, thân thiện và có tính chuyển đổi cao."
        : "Cuộc hội thoại đạt chuẩn, cần tăng tính gợi mở và tư vấn thêm.",
    grounding_relevance_score: grounding,
    overall_csat_score: Math.min(10, Math.max(1, overall)),
    politeness_score: politeness,
    sales_proactiveness_score: salesProactive,
    tool_precision_score: toolPrecision,
  }
}
