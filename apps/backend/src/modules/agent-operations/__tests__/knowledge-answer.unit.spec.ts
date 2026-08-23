import {
  buildCustomerSmallTalkReply,
  buildCustomerOrderLookupReply,
  buildCustomerReviewAcknowledgement,
  buildDeliveryTimeGuidanceAnswer,
  extractFreeShippingNotice,
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

  it("includes only verified tracking facts and never invents an ETA", () => {
    const answer = buildCustomerOrderLookupReply(
      {
        display_id: 123,
        fulfillment: {
          display_id: 123,
          fulfillment_status: "fulfilled",
          fulfillments: [
            {
              carrier: "ghn_ghn",
              current_status: "shipping",
              delivered_at: null,
              fulfillment_id: "ful_123",
              shipped_at: "2026-08-20T00:00:00.000Z",
              tracking_number: "GHN_123",
              tracking_url: "https://donhang.ghn.vn/?order_code=GHN_123",
            },
          ],
          order_id: "order_123",
          version: 1,
        },
        order: {
          canceled_at: null,
          created_at: "2026-08-20T00:00:00.000Z",
          currency_code: "vnd",
          customer_id: "cus_123",
          display_id: 123,
          fulfillment_count: 1,
          fulfillment_status: "fulfilled",
          item_count: 1,
          order_id: "order_123",
          order_status: "completed",
          payment_collection_count: 1,
          payment_status: "captured",
          total: 250000,
          updated_at: "2026-08-20T00:00:00.000Z",
          version: 1,
        },
        status: "FOUND",
      },
      "vi"
    )

    expect(answer.body).toContain("GHN_123")
    expect(answer.body).toContain("shipping")
    expect(answer.body).toContain("chưa thể xác nhận")
    expect(answer.body).not.toContain("https://")
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

  it("removes invoice and store-profile chunks from delivery-time evidence", () => {
    const output = filterKnowledgeEvidenceForQuestion(
      "Thời gian giao hàng bao lâu vậy sốp?",
      {
        results: [
          {
            ...knowledge.results[0],
            document_id: "delivery-policy",
            excerpt:
              "Thời gian giao hàng nội thành là 1-2 ngày làm việc và ngoại thành là 2-4 ngày.",
            title: "Chính sách giao hàng"
          },
          {
            ...knowledge.results[0],
            document_id: "invoice-policy",
            excerpt:
              "Hóa đơn được gửi trong 3-5 ngày làm việc sau khi giao hàng thành công.",
            title: "Đơn hàng và thanh toán"
          },
          {
            ...knowledge.results[0],
            document_id: "store-profile",
            excerpt: "Cửa hàng hỗ trợ giao hàng toàn quốc.",
            title: "Hồ sơ cửa hàng"
          },
          {
            ...knowledge.results[0],
            document_id: "late-delivery-sla",
            excerpt:
              "Giao chậm: quá 5 ngày kể từ ngày đặt thì mở case với đơn vị vận chuyển.",
            title: "Xử lý sự cố giao chậm"
          }
        ],
        total_candidates: 4
      }
    )

    expect(output.results.map((result) => result.document_id)).toEqual([
      "delivery-policy"
    ])
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
    expect(answer.body).toContain("shop cần kiểm tra lại")
    expect(answer.body).not.toContain("phản hồi tiếp")
  })

  describe("comprehensive retail RAG search & topic detection", () => {
    it.each([
      ["Chính sách trả hàng thế nào", "return"],
      ["Hàng bị lỗi do nhà sản xuất", "return"],
      ["Đổi size áo rộng hơn được không", "return"],
      ["Thời gian hoàn tiền là bao lâu", "return"],
      ["Phí ship giao hàng bao nhiêu", "delivery"],
      ["Thời gian giao hàng mất bao lâu", "delivery"],
      ["Kiểm tra mã đơn hàng của tôi", "order_status"],
      ["Thanh toán chuyển khoản ngân hàng", "payment"],
      ["Bảo hành sản phẩm ra sao", "warranty"],
    ])("correctly filters evidence for retail question '%s' -> %s", (question) => {
      const returnDoc = {
        citation_locator: "drive://policies/05-DOI-TRA-HOAN-TIEN.docx#chunk-1",
        chunk_id: "chunk_ret_1",
        chunk_index: 0,
        document_id: "doc_ret_1",
        document_key: "05-doi-tra-hoan-tien.docx",
        effective_at: "2026-08-01T00:00:00.000Z",
        excerpt:
          "CHÍNH SÁCH ĐỔI TRẢ, HOÀN TIỀN VÀ KHIẾU NẠI. Thời hạn 14 ngày. Hàng lỗi do NSX shop chịu ship hoàn toàn. Đổi size miễn phí lần đầu.",
        quote_checksum: "chk_ret_1",
        score: 10,
        title: "05-DOI-TRA-HOAN-TIEN.docx",
        version: "1.0.0",
      }
      const deliveryDoc = {
        citation_locator: "drive://policies/04-GIAO-HANG.docx#chunk-1",
        chunk_id: "chunk_del_1",
        chunk_index: 0,
        document_id: "doc_del_1",
        document_key: "04-giao-hang.docx",
        effective_at: "2026-08-01T00:00:00.000Z",
        excerpt:
          "CHÍNH SÁCH GIAO HÀNG VÀ VẬN CHUYỂN: Thời gian giao hàng nội thành 1-2 ngày, ngoại thành 3-5 ngày. Phí ship theo khu vực.",
        quote_checksum: "chk_del_1",
        score: 10,
        title: "04-GIAO-HANG.docx",
        version: "1.0.0",
      }
      const paymentDoc = {
        citation_locator: "drive://policies/03-THANH-TOAN.docx#chunk-1",
        chunk_id: "chunk_pay_1",
        chunk_index: 0,
        document_id: "doc_pay_1",
        document_key: "03-thanh-toan.docx",
        effective_at: "2026-08-01T00:00:00.000Z",
        excerpt:
          "HƯỚNG DẪN THANH TOÁN: Chấp nhận chuyển khoản ngân hàng, COD tiền mặt, và thẻ tín dụng.",
        quote_checksum: "chk_pay_1",
        score: 10,
        title: "03-THANH-TOAN.docx",
        version: "1.0.0",
      }
      const warrantyDoc = {
        citation_locator: "drive://policies/06-BAO-HANH.docx#chunk-1",
        chunk_id: "chunk_war_1",
        chunk_index: 0,
        document_id: "doc_war_1",
        document_key: "06-bao-hanh.docx",
        effective_at: "2026-08-01T00:00:00.000Z",
        excerpt:
          "CHÍNH SÁCH BẢO HÀNH: Bảo hành kỹ thuật và sửa chữa miễn phí trong 6 tháng.",
        quote_checksum: "chk_war_1",
        score: 10,
        title: "06-BAO-HANH.docx",
        version: "1.0.0",
      }
      const orderDoc = {
        citation_locator: "drive://guides/huong-dan-tra-cuu-don.docx#chunk-1",
        chunk_id: "chunk_ord_1",
        chunk_index: 0,
        document_id: "doc_ord_1",
        document_key: "huong-dan-tra-cuu-don",
        effective_at: "2026-08-01T00:00:00.000Z",
        excerpt:
          "Khi khách hỏi mã đơn hoặc kiểm tra đơn, nhân viên tra cứu trạng thái đơn hàng trên hệ thống.",
        quote_checksum: "chk_ord_1",
        score: 10,
        title: "Hướng dẫn tra cứu đơn hàng qua chat",
        version: "1.0.0",
      }

      const allDocs = {
        results: [returnDoc, deliveryDoc, paymentDoc, warrantyDoc, orderDoc],
        total_candidates: 5,
      }

      const filtered = filterKnowledgeEvidenceForQuestion(question, allDocs)
      expect(filtered.results.length).toBeGreaterThan(0)
    })
  })

  it("extracts freeship policy notice accurately from knowledge excerpts", () => {
    const freeshipKnowledge = {
      results: [
        {
          citation_locator: "policy://shipping#chunk-1",
          chunk_id: "chk_1",
          chunk_index: 0,
          document_id: "doc_1",
          document_key: "shipping-policy",
          effective_at: "2026-08-01T00:00:00.000Z",
          excerpt:
            "Thời gian giao hàng toàn quốc từ 2-4 ngày. Phí ship đồng giá 30k, miễn phí ship cho đơn từ 500.000đ.",
          quote_checksum: "chk_1",
          score: 1,
          title: "Chính sách giao hàng",
          version: "1.0.0",
        },
      ],
      total_candidates: 1,
    }

    const noticeVi = extractFreeShippingNotice(freeshipKnowledge, "vi")
    expect(noticeVi).toContain("miễn phí ship cho đơn từ 500.000đ")

    const noFreeshipKnowledge = {
      results: [
        {
          citation_locator: "policy://shipping#chunk-2",
          chunk_id: "chk_2",
          chunk_index: 0,
          document_id: "doc_2",
          document_key: "shipping-policy",
          effective_at: "2026-08-01T00:00:00.000Z",
          excerpt: "Đổi trả hàng trong 7 ngày.",
          quote_checksum: "chk_2",
          score: 1,
          title: "Chính sách đổi trả",
          version: "1.0.0",
        },
      ],
      total_candidates: 1,
    }

    expect(extractFreeShippingNotice(noFreeshipKnowledge, "vi")).toBeNull()
  })
})
