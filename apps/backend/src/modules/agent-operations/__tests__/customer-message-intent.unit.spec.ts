import {
  buildCustomerIntentReply,
  CustomerMessageIntentModelOutput,
  CUSTOMER_MESSAGE_INTENT_SYSTEM_PROMPT,
  defaultCustomerMessageIntent,
  detectCustomerMessageFastIntent,
  resolveCustomerMessageIntent,
} from "../customer-message-intent"

describe("customer message intent routing", () => {
  it.each([
    "SMALL_TALK",
    "CLARIFY",
    "PRODUCT_DISCOVERY",
    "STORE_QUESTION",
    "HUMAN_ACTION",
    "OUT_OF_SCOPE",
    "UNSAFE",
  ] as const)("accepts the structured %s intent", (intent) => {
    expect(
      CustomerMessageIntentModelOutput.safeParse({
        confidence: 0.9,
        intent,
        reason: "Test classification",
      }).success
    ).toBe(true)
  })

  it("rejects unknown intents and out-of-range confidence", () => {
    expect(
      CustomerMessageIntentModelOutput.safeParse({
        confidence: 1.5,
        intent: "DO_ANYTHING",
        reason: "Invalid",
      }).success
    ).toBe(false)
  })

  it("asks for clarification when staff authority is uncertain", () => {
    expect(
      resolveCustomerMessageIntent({
        confidence: 0.64,
        intent: "HUMAN_ACTION",
        reason: "Ambiguous request",
      })
    ).toBe("CLARIFY")
    expect(
      resolveCustomerMessageIntent({
        confidence: 0.9,
        intent: "HUMAN_ACTION",
        reason: "Explicit refund request",
      })
    ).toBe("HUMAN_ACTION")
  })

  it("falls back through governed knowledge instead of granting authority", () => {
    expect(defaultCustomerMessageIntent()).toMatchObject({
      confidence: 0,
      intent: "STORE_QUESTION",
    })
  })

  it("provides direct conversational and clarification replies", () => {
    expect(buildCustomerIntentReply("SMALL_TALK", "vi")).toContain(
      "nhân viên CSKH của Synapse"
    )
    expect(buildCustomerIntentReply("SMALL_TALK", "vi", true)).toContain(
      "sốp là nhân viên CSKH của Synapse"
    )
    expect(buildCustomerIntentReply("CLARIFY", "en")).toContain("Could you")
  })

  it("fast-routes obvious retail information questions without model latency", () => {
    expect(
      detectCustomerMessageFastIntent(
        "Mình muốn trả hàng á, quy trình thế nào?"
      )
    ).toBe("STORE_QUESTION")
    expect(detectCustomerMessageFastIntent("Hủy đơn hàng cho tôi ngay")).toBe(
      "HUMAN_ACTION"
    )
    expect(detectCustomerMessageFastIntent("Viết code Python cho tôi")).toBeNull()
    expect(detectCustomerMessageFastIntent("Sốp bạn bán về đồ gì?")).toBe(
      "PRODUCT_DISCOVERY"
    )
  })

  it("keeps tool execution and untrusted-input protections in the router", () => {
    expect(CUSTOMER_MESSAGE_INTENT_SYSTEM_PROMPT).toContain("no tools")
    expect(CUSTOMER_MESSAGE_INTENT_SYSTEM_PROMPT).toContain("untrusted data")
    expect(CUSTOMER_MESSAGE_INTENT_SYSTEM_PROMPT).toContain("HUMAN_ACTION")
  })
})
