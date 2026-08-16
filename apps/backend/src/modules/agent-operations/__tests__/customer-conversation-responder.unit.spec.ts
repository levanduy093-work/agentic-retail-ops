import {
  CustomerConversationModelOutput,
  CUSTOMER_CONVERSATION_SYSTEM_PROMPT,
  isSafeCustomerConversationBody,
} from "../customer-conversation-responder"

describe("customer conversation responder", () => {
  const friendlyFace = String.fromCodePoint(0x1f60a)
  const sparkle = String.fromCodePoint(0x2728)

  it("accepts a concise, friendly structured reply", () => {
    expect(
      CustomerConversationModelOutput.parse({
        body: "Có nè, sốp đang rảnh đây! Bạn cần sốp tư vấn gì không?",
      })
    ).toEqual({
      body: "Có nè, sốp đang rảnh đây! Bạn cần sốp tư vấn gì không?",
    })
  })

  it("rejects unsafe claims and excessive emoji", () => {
    expect(
      isSafeCustomerConversationBody("Sốp đã hoàn tiền cho bạn rồi.")
    ).toBe(false)
    expect(
      isSafeCustomerConversationBody(
        `Mình đây! Bạn cần gì nào? ${friendlyFace}${sparkle}`
      )
    ).toBe(false)
    expect(
      isSafeCustomerConversationBody(
        `Có nè, sốp đang rảnh đây! ${friendlyFace}`
      )
    ).toBe(true)
  })

  it("defines the natural persona and factual-data boundary", () => {
    expect(CUSTOMER_CONVERSATION_SYSTEM_PROMPT).toContain(
      "availability question needs an availability answer"
    )
    expect(CUSTOMER_CONVERSATION_SYSTEM_PROMPT).toContain(
      "no approved knowledge, catalog snapshot, or live order data"
    )
    expect(CUSTOMER_CONVERSATION_SYSTEM_PROMPT).toContain(
      "at most one useful follow-up question"
    )
    expect(CUSTOMER_CONVERSATION_SYSTEM_PROMPT).toContain(
      "nhân viên CSKH của Synapse"
    )
  })
})
