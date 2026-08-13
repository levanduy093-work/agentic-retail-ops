import {
  buildCustomerSmallTalkReply,
  buildCustomerReviewAcknowledgement,
  buildKnowledgeAnswerFallback,
  detectKnowledgeQuestionLocale,
  filterKnowledgeEvidenceForQuestion,
  formatChannelKnowledgeAnswer,
  hasSufficientKnowledgeEvidence,
  isContextDependentKnowledgeQuestion,
  isKnowledgeAnswerBodySafe,
  KnowledgeAnswerModelOutput,
  resolveGovernedKnowledgeModelOutput,
  shouldUseSemanticKnowledgeSearch,
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
    expect(formatChannelKnowledgeAnswer(answer)).not.toContain("policy://")
    expect(
      formatChannelKnowledgeAnswer(answer, 4_000, {
        include_citations: true,
      })
    ).toContain(
      "Nguồn:\n1. Chính sách đổi trả (1.0)"
    )
  })

  it("skips semantic embedding when lexical evidence is already strong", () => {
    expect(shouldUseSemanticKnowledgeSearch(knowledge)).toBe(false)
    expect(
      shouldUseSemanticKnowledgeSearch({ results: [], total_candidates: 0 })
    ).toBe(true)
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
    expect(detectKnowledgeQuestionLocale("Alo shop oi")).toBe("vi")
    expect(detectKnowledgeQuestionLocale("Hello sốp")).toBe("vi")
    expect(isContextDependentKnowledgeQuestion("Thế còn hoàn tiền thì sao?")).toBe(
      true
    )
    expect(
      isContextDependentKnowledgeQuestion("Quy trình trả hàng thế nào?")
    ).toBe(false)
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

  it.each([
    ["Hello", "en"],
    ["Hi there!", "en"],
    ["Xin chào", "vi"],
    ["Chào shop ạ", "vi"],
    ["Chào sốp", "vi"],
    ["Cảm ơn shop nhé", "vi"],
    ["Tạm biệt", "vi"],
    ["Dạ", "vi"],
  ] as const)("answers small talk without knowledge: %s", (message, locale) => {
    expect(buildCustomerSmallTalkReply(message, locale)).toMatchObject({
      citations: [],
      disposition: "SMALL_TALK",
      grounded: false,
      locale,
    })
  })

  it("does not misclassify store questions as small talk", () => {
    expect(
      buildCustomerSmallTalkReply(
        "Xin chào, chính sách đổi trả của shop thế nào?",
        "vi"
      )
    ).toBeNull()
    expect(
      buildCustomerSmallTalkReply("Can you change my delivery address?", "en")
    ).toBeNull()
  })

  it("answers the shop persona availability question naturally", () => {
    expect(buildCustomerSmallTalkReply("Sốp có rảnh không?", "vi")?.body).toContain(
      "sốp đang rảnh"
    )
  })

  it("rejects an order-status chunk for a return-process question", () => {
    const wrongTopic = {
      ...knowledge,
      results: [
        {
          ...knowledge.results[0],
          excerpt:
            "Nhân viên cần kiểm tra trạng thái đơn hàng trước khi trả lời khách.",
          title: "Hướng dẫn trạng thái đơn hàng",
        },
      ],
    }

    expect(
      filterKnowledgeEvidenceForQuestion(
        "Mình muốn trả hàng, quy trình thế nào?",
        wrongTopic
      ).results
    ).toEqual([])
    expect(
      filterKnowledgeEvidenceForQuestion(
        "Mình muốn trả hàng, quy trình thế nào?",
        knowledge
      ).results
    ).toHaveLength(1)
  })

  it("preserves human review when retrieved chunks do not answer the question", () => {
    const answer = resolveGovernedKnowledgeModelOutput(
      {
        body: "I need staff review because this evidence is about order status.",
        disposition: "HUMAN_REVIEW",
      },
      knowledge,
      "vi"
    )

    expect(answer).toMatchObject({
      citations: [],
      disposition: "HUMAN_REVIEW",
      grounded: false,
    })
    expect(formatChannelKnowledgeAnswer(answer)).not.toContain(
      knowledge.results[0].excerpt
    )
  })

  it("acknowledges human review without inventing an answer", () => {
    const answer = buildCustomerReviewAcknowledgement(
      "vi",
      "NO_APPROVED_KNOWLEDGE"
    )

    expect(answer).toMatchObject({
      citations: [],
      disposition: "HUMAN_REVIEW",
      grounded: false,
    })
    expect(answer.body).toContain("nhân viên kiểm tra")
  })
})
