import {
  buildCustomerConversationContext,
  buildConversationMemoryFallback,
  ConversationMemoryModelOutput,
  shouldRefreshConversationMemoryWithAi,
} from "../conversation-memory"

describe("conversation memory", () => {
  it("compacts the previous summary with only the recent turn", () => {
    const result = buildConversationMemoryFallback({
      previous_summary: "Customer asked about returns.",
      recent_messages: [
        { body: "Sản phẩm bị hỏng", direction: "INBOUND" },
        { body: "Cửa hàng cần kiểm tra thêm.", direction: "OUTBOUND" },
      ],
    })

    expect(result.summary).toContain("Customer asked about returns.")
    expect(result.summary).toContain("Sản phẩm bị hỏng")
    expect(ConversationMemoryModelOutput.parse(result)).toEqual(result)
  })

  it("combines current chat memory with tenant-scoped customer history", () => {
    const context = buildCustomerConversationContext({
      current_summary: "Customer is choosing a cotton shirt.",
      previous_conversation_summaries: [
        "Customer prefers black and usually chooses size M.",
      ],
    })

    expect(context).toContain("Current conversation")
    expect(context).toContain("Previous conversations with this customer")
    expect(context).toContain("size M")
    expect(context.length).toBeLessThanOrEqual(1_600)
  })

  it("uses AI memory compaction on the first turn and then every third turn", () => {
    expect(
      shouldRefreshConversationMemoryWithAi({
        has_existing_memory: false,
        message_count: 2,
      })
    ).toBe(true)
    expect(
      shouldRefreshConversationMemoryWithAi({
        has_existing_memory: true,
        message_count: 4,
      })
    ).toBe(false)
    expect(
      shouldRefreshConversationMemoryWithAi({
        has_existing_memory: true,
        message_count: 6,
      })
    ).toBe(true)
  })
})
