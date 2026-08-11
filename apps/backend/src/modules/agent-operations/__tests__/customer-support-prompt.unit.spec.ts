import {
  CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT,
  CUSTOMER_SUPPORT_PROMPT_VERSION,
} from "../customer-support-prompt"

describe("customer support prompt", () => {
  it("answers in the language used by the customer question", () => {
    expect(CUSTOMER_SUPPORT_PROMPT_VERSION).toBe("2.1.0")
    expect(CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT).toContain(
      "write the entire reply in that same language"
    )
    expect(CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT).toContain(
      "use its dominant language"
    )
    expect(CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT).toContain(
      "Use the supplied locale only when the question's language cannot be determined"
    )
  })
})
