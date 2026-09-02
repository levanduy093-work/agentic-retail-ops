import { MedusaError } from "@medusajs/framework/utils"
import { assertCustomerChatConversationOwnership } from "../customer-chat-ownership"
import { StoreCreateCustomerChatMessage } from "../../../api/store/customer-chat/validators"

describe("customer chat conversation ownership", () => {
  const ownedConversation = {
    channel: "IN_APP",
    metadata: {
      customer_id: "cus_owner",
      principal_role: "CUSTOMER",
    },
    topic_type: "CUSTOMER_SUPPORT_CHAT",
  }

  it("accepts only the authenticated customer who owns an in-app support conversation", () => {
    expect(() =>
      assertCustomerChatConversationOwnership(ownedConversation, "cus_owner")
    ).not.toThrow()
  })

  it("rejects another customer and non-customer conversation types", () => {
    expect(() =>
      assertCustomerChatConversationOwnership(ownedConversation, "cus_other")
    ).toThrow(MedusaError)
    expect(() =>
      assertCustomerChatConversationOwnership(
        {
          ...ownedConversation,
          topic_type: "OPERATOR_CHAT",
        },
        "cus_owner"
      )
    ).toThrow(MedusaError)
  })

  it("does not accept a customer identity or profile supplied by the browser", () => {
    expect(
      StoreCreateCustomerChatMessage.safeParse({
        customer_id: "cus_other",
        locale: "vi",
        message: "Cho mình xem đơn hàng.",
      }).success
    ).toBe(false)
    expect(
      StoreCreateCustomerChatMessage.safeParse({
        locale: "vi",
        message: "Cho mình xem đơn hàng.",
      }).success
    ).toBe(true)
  })

  it("allows a server-uploaded attachment list of any size", () => {
    expect(
      StoreCreateCustomerChatMessage.safeParse({
        attachment_ids: ["file_1", "file_2"],
        message: "Ảnh hàng bị lỗi đây ạ.",
      }).success
    ).toBe(true)
    expect(
      StoreCreateCustomerChatMessage.safeParse({
        attachment_ids: ["file_1", "file_2", "file_3", "file_4"],
        message: "Ảnh hàng bị lỗi đây ạ.",
      }).success
    ).toBe(true)
  })

  it("bounds browser-supplied idempotency and conversation identifiers", () => {
    expect(
      StoreCreateCustomerChatMessage.safeParse({
        client_message_id: "client-message-1",
        conversation_id: "agconv_1",
        message: "Kiểm tra giúp mình nhé.",
      }).success
    ).toBe(true)
    expect(
      StoreCreateCustomerChatMessage.safeParse({
        client_message_id: "x".repeat(121),
        message: "Kiểm tra giúp mình nhé.",
      }).success
    ).toBe(false)
  })
})
