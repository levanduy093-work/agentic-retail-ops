import {
  filterKnowledgeEvidenceForQuestion,
  buildKnowledgeAnswerFallback,
  buildDeliveryTimeGuidanceAnswer,
  detectKnowledgeQuestionLocale,
  hasSufficientKnowledgeEvidence,
  resolveGovernedKnowledgeModelOutput,
} from "../knowledge-answer"
import { searchKnowledgeChunks } from "../tools/platform-read-tools"
import { checksumKnowledgeContent } from "../knowledge"

describe("Continuous RAG Knowledge Benchmark & Ground-Truth Verification", () => {
  // Real store policy documents loaded into the Knowledge Hub
  const returnPolicyDoc = {
    approved_at: "2026-08-01T00:00:00.000Z",
    citation_locator: "drive://policies/05-DOI-TRA-HOAN-TIEN.docx",
    content: "CHÍNH SÁCH ĐỔI TRẢ, HOÀN TIỀN VÀ KHIẾU NẠI",
    document_key: "05-doi-tra-hoan-tien.docx",
    effective_at: "2026-08-01T00:00:00.000Z",
    expires_at: null,
    id: "doc_policy_returns_005",
    status: "APPROVED",
    title: "05-DOI-TRA-HOAN-TIEN.docx",
    version: "1.0.0",
  }

  const shippingPolicyDoc = {
    approved_at: "2026-08-01T00:00:00.000Z",
    citation_locator: "drive://policies/04-GIAO-HANG.docx",
    content: "CHÍNH SÁCH VẬN CHUYỂN VÀ GIAO NHẬN",
    document_key: "04-giao-hang.docx",
    effective_at: "2026-08-01T00:00:00.000Z",
    expires_at: null,
    id: "doc_policy_shipping_004",
    status: "APPROVED",
    title: "04-GIAO-HANG.docx",
    version: "1.0.0",
  }

  const paymentPolicyDoc = {
    approved_at: "2026-08-01T00:00:00.000Z",
    citation_locator: "drive://policies/03-DON-HANG-THANH-TOAN.docx",
    content: "QUY TRÌNH ĐẶT HÀNG VÀ CHÍNH SÁCH THANH TOÁN",
    document_key: "03-don-hang-thanh-toan.docx",
    effective_at: "2026-08-01T00:00:00.000Z",
    expires_at: null,
    id: "doc_policy_payment_003",
    status: "APPROVED",
    title: "03-DON-HANG-THANH-TOAN.docx",
    version: "1.0.0",
  }

  const warrantyPolicyDoc = {
    approved_at: "2026-08-01T00:00:00.000Z",
    citation_locator: "drive://policies/06-BAO-HANH-CHAT-LUONG.docx",
    content: "CHÍNH SÁCH BẢO HÀNH VÀ CAM KẾT CHẤT LƯỢNG",
    document_key: "06-bao-hanh-chat-luong.docx",
    effective_at: "2026-08-01T00:00:00.000Z",
    expires_at: null,
    id: "doc_policy_warranty_006",
    status: "APPROVED",
    title: "06-BAO-HANH-CHAT-LUONG.docx",
    version: "1.0.0",
  }

  const orderLookupGuideDoc = {
    approved_at: "2026-08-01T00:00:00.000Z",
    citation_locator: "drive://guides/huong-dan-tra-cuu-don-hang.docx",
    content: "Hướng dẫn tra cứu đơn hàng qua chat",
    document_key: "huong-dan-tra-cuu-don-hang",
    effective_at: "2026-08-01T00:00:00.000Z",
    expires_at: null,
    id: "doc_guide_order_lookup",
    status: "APPROVED",
    title: "Hướng dẫn tra cứu đơn hàng qua chat",
    version: "1.0.0",
  }

  const storeDocuments = [
    returnPolicyDoc,
    shippingPolicyDoc,
    paymentPolicyDoc,
    warrantyPolicyDoc,
    orderLookupGuideDoc,
  ]

  const returnChunk1 = {
    checksum: checksumKnowledgeContent(
      "CHÍNH SÁCH ĐỔI TRẢ, HOÀN TIỀN VÀ KHIẾU NẠI. 1. ĐIỀU KIỆN ĐỔI/TRẢ: Thời hạn từ ngày nhận hàng: 14 ngày kể từ ngày giao hàng thành công. Tình trạng hàng: Còn nguyên tem mác, hóa đơn (nếu có), chưa qua sử dụng, chưa qua giặt ủi và không bị hư hỏng. Chi phí vận chuyển đổi trả: Miễn phí vận chuyển 1 chiều cho lần đổi size/mẫu đầu tiên."
    ),
    chunk_index: 0,
    citation_locator: "drive://policies/05-DOI-TRA-HOAN-TIEN.docx#chunk-1",
    content:
      "CHÍNH SÁCH ĐỔI TRẢ, HOÀN TIỀN VÀ KHIẾU NẠI. 1. ĐIỀU KIỆN ĐỔI/TRẢ: Thời hạn từ ngày nhận hàng: 14 ngày kể từ ngày giao hàng thành công. Tình trạng hàng: Còn nguyên tem mác, hóa đơn (nếu có), chưa qua sử dụng, chưa qua giặt ủi và không bị hư hỏng. Chi phí vận chuyển đổi trả: Miễn phí vận chuyển 1 chiều cho lần đổi size/mẫu đầu tiên.",
    document_id: returnPolicyDoc.id,
    id: "chunk_ret_1",
  }

  const returnChunk2 = {
    checksum: checksumKnowledgeContent(
      "2. HÀNG LỖI, SAI HOẶC THIẾU: Hàng lỗi do NSX, ship do shop chịu hoàn toàn. Thời hạn thông báo sự cố: Trong vòng 3 ngày kể từ khi nhận hàng. 3. HOÀN TIỀN: Hoàn tất trong vòng 3-7 ngày làm việc của khách theo hình thức chuyển khoản hoặc ví/tài khoản thanh toán ban đầu."
    ),
    chunk_index: 1,
    citation_locator: "drive://policies/05-DOI-TRA-HOAN-TIEN.docx#chunk-2",
    content:
      "2. HÀNG LỖI, SAI HOẶC THIẾU: Hàng lỗi do NSX, ship do shop chịu hoàn toàn. Thời hạn thông báo sự cố: Trong vòng 3 ngày kể từ khi nhận hàng. 3. HOÀN TIỀN: Hoàn tất trong vòng 3-7 ngày làm việc của khách theo hình thức chuyển khoản hoặc ví/tài khoản thanh toán ban đầu.",
    document_id: returnPolicyDoc.id,
    id: "chunk_ret_2",
  }

  const shippingChunk = {
    checksum: checksumKnowledgeContent(
      "CHÍNH SÁCH GIAO HÀNG: Đơn hàng nội thành giao trong 1-2 ngày làm việc. Đơn hàng liên tỉnh giao trong 3-5 ngày làm việc. Khi khách hỏi trạng thái giao hàng, nhân viên kiểm tra trạng thái thanh toán và giao hàng trên hệ thống."
    ),
    chunk_index: 0,
    citation_locator: "drive://policies/04-GIAO-HANG.docx#chunk-1",
    content:
      "CHÍNH SÁCH GIAO HÀNG: Đơn hàng nội thành giao trong 1-2 ngày làm việc. Đơn hàng liên tỉnh giao trong 3-5 ngày làm việc. Khi khách hỏi trạng thái giao hàng, nhân viên kiểm tra trạng thái thanh toán và giao hàng trên hệ thống.",
    document_id: shippingPolicyDoc.id,
    id: "chunk_ship_1",
  }

  const paymentChunk = {
    checksum: checksumKnowledgeContent(
      "PHƯƠNG THỨC THANH TOÁN: Cửa hàng hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng qua mã QR VietQR, và thẻ tín dụng/ghi nợ quốc tế Visa/Mastercard."
    ),
    chunk_index: 0,
    citation_locator: "drive://policies/03-DON-HANG-THANH-TOAN.docx#chunk-1",
    content:
      "PHƯƠNG THỨC THANH TOÁN: Cửa hàng hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng qua mã QR VietQR, và thẻ tín dụng/ghi nợ quốc tế Visa/Mastercard.",
    document_id: paymentPolicyDoc.id,
    id: "chunk_pay_1",
  }

  const warrantyChunk = {
    checksum: checksumKnowledgeContent(
      "CHÍNH SÁCH BẢO HÀNH VÀ CHẤT LƯỢNG: Các sản phẩm phụ kiện và áo khoác cao cấp được bảo hành đường may, khóa kéo trong vòng 6 tháng kể từ ngày mua."
    ),
    chunk_index: 0,
    citation_locator: "drive://policies/06-BAO-HANH-CHAT-LUONG.docx#chunk-1",
    content:
      "CHÍNH SÁCH BẢO HÀNH VÀ CHẤT LƯỢNG: Các sản phẩm phụ kiện và áo khoác cao cấp được bảo hành đường may, khóa kéo trong vòng 6 tháng kể từ ngày mua.",
    document_id: warrantyPolicyDoc.id,
    id: "chunk_war_1",
  }

  const orderLookupChunk = {
    checksum: checksumKnowledgeContent(
      "HƯỚNG DẪN TRA CỨU ĐƠN HÀNG: Khi khách hỏi trạng thái đơn hàng, nhân viên cần kiểm tra trạng thái thanh toán và giao hàng trực tiếp trên hệ thống trước khi trả lời."
    ),
    chunk_index: 0,
    citation_locator: "drive://guides/huong-dan-tra-cuu-don-hang.docx#chunk-1",
    content:
      "HƯỚNG DẪN TRA CỨU ĐƠN HÀNG: Khi khách hỏi trạng thái đơn hàng, nhân viên cần kiểm tra trạng thái thanh toán và giao hàng trực tiếp trên hệ thống trước khi trả lời.",
    document_id: orderLookupGuideDoc.id,
    id: "chunk_lookup_1",
  }

  const storeChunks = [
    returnChunk1,
    returnChunk2,
    shippingChunk,
    paymentChunk,
    warrantyChunk,
    orderLookupChunk,
  ]

  // Positive & Negative Test Cases
  const testScenarios = [
    {
      expectedDocKey: "05-doi-tra-hoan-tien.docx",
      expectedFacts: ["14 ngày", "chưa qua sử dụng"],
      id: "return-policy-general",
      question: "Chính sách trả hàng thế nào",
    },
    {
      expectedDocKey: "05-doi-tra-hoan-tien.docx",
      expectedFacts: ["14 ngày", "Miễn phí vận chuyển 1 chiều"],
      id: "return-policy-exchange-size",
      question: "Mình muốn đổi size áo thì quy định thế nào ạ?",
    },
    {
      expectedDocKey: "05-doi-tra-hoan-tien.docx",
      expectedFacts: ["Hàng lỗi do NSX", "shop chịu hoàn toàn"],
      id: "return-policy-defect-fee",
      question: "Hàng nhận về bị lỗi rách thì phí ship ai chịu sốp ơi?",
    },
    {
      expectedDocKey: "05-doi-tra-hoan-tien.docx",
      expectedFacts: ["3-7 ngày làm việc"],
      id: "return-policy-refund-time",
      question: "Bao lâu thì nhận được tiền hoàn trả lại vậy?",
    },
    {
      expectedDocKey: "04-giao-hang.docx",
      expectedFacts: ["1-2 ngày", "3-5 ngày"],
      id: "shipping-timeline",
      question: "Thời gian giao hàng mất bao lâu?",
    },
    {
      expectedDocKey: "03-don-hang-thanh-toan.docx",
      expectedFacts: ["COD", "chuyển khoản ngân hàng", "Visa/Mastercard"],
      id: "payment-methods",
      question: "Shop có những hình thức thanh toán nào?",
    },
    {
      expectedDocKey: "06-bao-hanh-chat-luong.docx",
      expectedFacts: ["6 tháng", "khóa kéo"],
      id: "warranty-terms",
      question: "Khóa kéo áo khoác có được bảo hành không sốp?",
    },
  ]

  describe("Continuous Question vs Knowledge Evaluation", () => {
    test.each(testScenarios)(
      "Scenario $id: Evaluates '$question' correctly against knowledge base",
      ({ expectedDocKey, expectedFacts, question }) => {
        // 1. Search Knowledge Chunks
        const searchResult = searchKnowledgeChunks(
          { limit: 5, locale: "vi", query: question, tenant_id: "default" },
          storeDocuments,
          storeChunks
        )

        expect(searchResult.results.length).toBeGreaterThan(0)
        expect(searchResult.results[0].document_key).toBe(expectedDocKey)

        // 2. Filter evidence by topic
        const filteredEvidence = filterKnowledgeEvidenceForQuestion(
          question,
          searchResult
        )
        expect(filteredEvidence.results.length).toBeGreaterThan(0)
        expect(hasSufficientKnowledgeEvidence(filteredEvidence)).toBe(true)

        // 3. Generate Grounded Answer Fallback
        const groundedAnswer = buildKnowledgeAnswerFallback(
          filteredEvidence,
          "vi"
        )
        expect(groundedAnswer.disposition).toBe("ANSWER")
        expect(groundedAnswer.grounded).toBe(true)
        expect(groundedAnswer.citations.length).toBeGreaterThan(0)

        // 4. Verify Ground-Truth Facts in Retrieved Knowledge
        const retrievedContent = filteredEvidence.results
          .map((r) => r.excerpt)
          .join(" ")
        for (const fact of expectedFacts) {
          expect(retrievedContent).toContain(fact)
        }
      }
    )
  })

  describe("Negative and Edge-Case Safety Checks", () => {
    it("handles out-of-scope non-store questions gracefully", () => {
      const outOfScopeQuery = "Viết code giải phương trình bậc 2 bằng Python"
      const result = searchKnowledgeChunks(
        { limit: 5, locale: "vi", query: outOfScopeQuery, tenant_id: "default" },
        storeDocuments,
        storeChunks
      )
      const filtered = filterKnowledgeEvidenceForQuestion(
        outOfScopeQuery,
        result
      )
      expect(filtered.results).toHaveLength(0)
      expect(hasSufficientKnowledgeEvidence(filtered)).toBe(false)
    })
  })
})
