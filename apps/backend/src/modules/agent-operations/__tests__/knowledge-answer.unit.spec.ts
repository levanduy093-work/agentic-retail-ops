import {
  buildKnowledgeAnswerFallback,
  detectKnowledgeQuestionLocale,
  formatChannelKnowledgeAnswer,
  hasSufficientKnowledgeEvidence,
  isKnowledgeAnswerBodySafe,
  KnowledgeAnswerModelOutput,
} from "../knowledge-answer"

describe("grounded knowledge answers", () => {
  const knowledge = {
    results: [
      {
        citation_locator: "drive://returns#chunk-1",
        chunk_id: "chunk_1",
        chunk_index: 0,
        document_id: "document_1",
        document_key: "returns",
        effective_at: "2026-08-12T00:00:00.000Z",
        excerpt: "Khách hàng có thể đổi sản phẩm trong vòng 7 ngày.",
        quote_checksum: "checksum_1",
        score: 0.9,
        title: "Chính sách đổi trả",
        version: "1.0",
      },
    ],
    total_candidates: 1,
  }

  it("builds deterministic citations separately from generated text", () => {
    const answer = buildKnowledgeAnswerFallback(knowledge, "vi")

    expect(answer).toMatchObject({ grounded: true, locale: "vi" })
    expect(answer.citations).toEqual([
      expect.objectContaining({
        document_id: "document_1",
        locator: "drive://returns#chunk-1",
        quote_checksum: "checksum_1",
      }),
    ])
    expect(formatChannelKnowledgeAnswer(answer)).toContain(
      "Nguồn:\n1. Chính sách đổi trả (1.0)"
    )
  })

  it("refuses safely when approved knowledge has no result", () => {
    const answer = buildKnowledgeAnswerFallback(
      { results: [], total_candidates: 0 },
      "vi"
    )

    expect(answer.grounded).toBe(false)
    expect(answer.citations).toEqual([])
    expect(answer.body).toContain("Không có đủ kiến thức")
  })

  it("detects Vietnamese and enforces a bounded model response", () => {
    expect(detectKnowledgeQuestionLocale("Chính sách đổi trả thế nào?")).toBe(
      "vi"
    )
    expect(detectKnowledgeQuestionLocale("What is the return policy?")).toBe(
      "en"
    )
    expect(
      KnowledgeAnswerModelOutput.safeParse({
        body: "Valid",
        disposition: "ANSWER",
      }).success
    ).toBe(true)
    expect(KnowledgeAnswerModelOutput.safeParse({ body: "" }).success).toBe(
      false
    )
  })

  it("enforces backend evidence and rejects model-invented URLs", () => {
    expect(hasSufficientKnowledgeEvidence(knowledge)).toBe(true)
    expect(
      hasSufficientKnowledgeEvidence({
        ...knowledge,
        results: [{ ...knowledge.results[0], score: 0.2 }],
      })
    ).toBe(false)
    expect(
      isKnowledgeAnswerBodySafe("Xem https://attacker.example", knowledge)
    ).toBe(false)
    expect(
      isKnowledgeAnswerBodySafe("Khách hàng được đổi trong 7 ngày.", knowledge)
    ).toBe(true)
  })
})
