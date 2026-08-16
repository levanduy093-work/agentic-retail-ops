import {
  buildCustomerSmallTalkReply,
  buildCustomerOrderLookupReply,
  buildCustomerReviewAcknowledgement,
  buildDeliveryTimeGuidanceAnswer,
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

  it("asks for an order number before any delivery-status lookup", () => {
    const deliveryKnowledge = {
      results: [
        {
          ...knowledge.results[0],
          excerpt:
            "Khi khách hỏi trạng thái đơn hàng, nhân viên cần kiểm tra trạng thái thanh toán và giao hàng trực tiếp trên hệ thống trước khi trả lời.",
        },
      ],
      total_candidates: 1,
    }
    const answer = buildDeliveryTimeGuidanceAnswer(
      "Thời gian giao hàng bao lâu vậy sốp?",
      deliveryKnowledge,
      "vi"
    )

    expect(answer?.body).toContain("mã đơn")
    expect(answer?.pending_customer_input).toBe("ORDER_REFERENCE")
  })

  it("does not disclose an order when the linked customer does not own it", () => {
    const answer = buildCustomerOrderLookupReply(
      { display_id: 123, status: "NOT_OWNER" },
      "vi"
    )

    expect(answer.grounded).toBe(false)
    expect(answer.body).toContain("không khớp")
    expect(answer.body).not.toContain("thanh toán:")
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
    expect(buildCustomerSmallTalkReply("Rảnh k sốp", "vi")?.body).toContain(
      "sốp đang rảnh"
    )
  })

  it("uses Synapse CSKH as the default identity and mirrors shop wording only when used by the customer", () => {
    expect(buildCustomerSmallTalkReply("Xin chào", "vi")?.body).toContain(
      "nhân viên CSKH của Synapse"
    )
    expect(
      buildCustomerSmallTalkReply("mình tên Duy sốp tên gì vậy nhỉ", "vi")
        ?.body
    ).toContain("sốp là nhân viên CSKH của Synapse")
  })

  it("recognizes an approved return-policy document for a short return request", () => {
    expect(
      filterKnowledgeEvidenceForQuestion("Mình muốn trả hàng á", knowledge)
        .results
    ).toHaveLength(1)
  })

  it("rejects an order-status chunk for a return-process question", () => {
    const wrongTopic = {
      ...knowledge,
      results: [
        {
          ...knowledge.results[0],
          excerpt:
            "Nhân viên cần kiểm tra trạng thái đơn hàng trước khi trả lời khách.",
          document_key: "order-status",
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
    expect(
      filterKnowledgeEvidenceForQuestion("Mình muốn trả hàng á", wrongTopic)
        .results
    ).toEqual([])
  })

  it("keeps order preparation and shipping guidance for a delivery-time question", () => {
    const deliveryGuidance = {
      ...knowledge,
      results: [
        {
          ...knowledge.results[0],
          document_key: "order-status-response-guide",
          excerpt:
            "Khi khách hỏi thời gian giao hàng, nhân viên cần kiểm tra trạng thái chuẩn bị hàng và vận chuyển trước khi trả lời.",
          title: "Hướng dẫn trả lời trạng thái đơn hàng",
        },
      ],
    }

    expect(
      filterKnowledgeEvidenceForQuestion(
        "Thời gian giao hàng bao lâu?",
        deliveryGuidance
      ).results
    ).toHaveLength(1)
  })

  it("turns approved order-status guidance into a safe delivery-time answer", () => {
    const deliveryGuidance = buildDeliveryTimeGuidanceAnswer(
      "Thời gian giao hàng bao lâu?",
      {
        ...knowledge,
        results: [
          {
            ...knowledge.results[0],
            excerpt:
              "Khi khách hỏi trạng thái đơn hàng, nhân viên cần kiểm tra trạng thái thanh toán và giao hàng trực tiếp trên hệ thống trước khi trả lời.",
          },
        ],
      },
      "vi"
    )

    expect(deliveryGuidance).toMatchObject({
      disposition: "ANSWER",
      grounded: true,
    })
    expect(deliveryGuidance?.body).toContain("trạng thái thanh toán và giao hàng")
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
    expect(answer.body).toContain("nhân viên cần kiểm tra")
    expect(answer.body).not.toContain("phản hồi tiếp")
  })
})
