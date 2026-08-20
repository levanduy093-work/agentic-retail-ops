import { analyzeCustomerSentiment } from "../customer-sentiment-analyzer"

describe("customer sentiment analyzer", () => {
  it("detects frustrated and angry messages and flags them as critical urgency", () => {
    const result = analyzeCustomerSentiment(
      "Sao 4 ngày rồi hàng vẫn chưa tới? Làm ăn chán quá shop ơi!"
    )

    expect(result.sentiment).toBe("FRUSTRATED_ANGRY")
    expect(result.urgency).toBe("CRITICAL")
    expect(result.needs_immediate_escalation).toBe(true)
    expect(result.empathetic_response).toContain("rất xin lỗi")
  })

  it("detects confused customers seeking guidance", () => {
    const result = analyzeCustomerSentiment(
      "Chính sách đổi trả này mình chưa hiểu lắm, nghĩa là sao ạ?"
    )

    expect(result.sentiment).toBe("CONFUSED")
    expect(result.urgency).toBe("NORMAL")
    expect(result.needs_immediate_escalation).toBe(false)
  })

  it("detects satisfied and delighted customers", () => {
    const result = analyzeCustomerSentiment(
      "Đầm xinh quá shop ơi, mặc vừa in luôn 10 điểm ạ!"
    )

    expect(result.sentiment).toBe("SATISFIED")
    expect(result.urgency).toBe("NORMAL")
    expect(result.needs_immediate_escalation).toBe(false)
  })

  it("classifies standard inquiries as neutral", () => {
    const result = analyzeCustomerSentiment("Shop có áo sơ mi trắng không?")

    expect(result.sentiment).toBe("NEUTRAL")
    expect(result.urgency).toBe("NORMAL")
  })
})
