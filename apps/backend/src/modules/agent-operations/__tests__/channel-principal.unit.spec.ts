import {
  getConversationTopicType,
  isCustomerSupportConversation,
} from "../channel-principal"

describe("channel principal authorization", () => {
  it("routes owners and customers to separate conversation types", () => {
    expect(getConversationTopicType("OWNER")).toBe("OPERATOR_CHAT")
    expect(getConversationTopicType("CUSTOMER")).toBe(
      "CUSTOMER_SUPPORT_CHAT"
    )
  })

  it("only authorizes customer-scoped conversations for RAG", () => {
    expect(
      isCustomerSupportConversation({
        metadata: { principal_role: "CUSTOMER" },
        topic_type: "CUSTOMER_SUPPORT_CHAT",
      })
    ).toBe(true)
    expect(
      isCustomerSupportConversation({
        metadata: { principal_role: "OWNER" },
        topic_type: "OPERATOR_CHAT",
      })
    ).toBe(false)
    expect(
      isCustomerSupportConversation({
        metadata: { principal_role: "CUSTOMER" },
        topic_type: "HUMAN_APPROVAL",
      })
    ).toBe(false)
  })
})
