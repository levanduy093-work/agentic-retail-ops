import {
  AssistantSettingsSchema,
  DEFAULT_ASSISTANT_SETTINGS,
  MANAGED_PROMPTS_REGISTRY
} from "../assistant-settings"
import { CUSTOMER_MESSAGE_INTENT_PROMPT_KEY } from "../customer-message-intent"
import { KNOWLEDGE_ANSWER_PROMPT_KEY } from "../knowledge-answer"
import { PRODUCT_ADVISOR_PROMPT_KEY } from "../customer-product-advisor"
import { CUSTOMER_SUPPORT_PROMPT_KEY } from "../customer-support-prompt"

describe("assistant settings and managed prompts registry", () => {
  it("validates default assistant settings schema", () => {
    const parsed = AssistantSettingsSchema.parse(DEFAULT_ASSISTANT_SETTINGS)
    expect(parsed.brand_name).toBe("Synapse")
    expect(parsed.bot_role).toBe("nhân viên CSKH")
    expect(parsed.greeting_message_vi).toContain("Synapse")
    expect(parsed.native_tool_loop_mode).toBe("ACTIVE")
    expect(parsed.review_ack_message_vi).toContain("shop cần kiểm tra lại")
  })

  it("supports customizing brand name and tone", () => {
    const custom = {
      brand_name: "Duy Fashion",
      bot_role: "chuyên viên tư vấn",
      greeting_message_vi: "Dạ em chào anh/chị, em là tư vấn viên của Duy Fashion ạ!"
    }
    const merged = AssistantSettingsSchema.parse({
      ...DEFAULT_ASSISTANT_SETTINGS,
      ...custom
    })
    expect(merged.brand_name).toBe("Duy Fashion")
    expect(merged.bot_role).toBe("chuyên viên tư vấn")
    expect(merged.greeting_message_vi).toContain("Duy Fashion")
  })

  it("permits active and shadow native tool rollouts", () => {
    expect(
      AssistantSettingsSchema.parse({
        ...DEFAULT_ASSISTANT_SETTINGS,
        native_tool_loop_mode: "SHADOW"
      }).native_tool_loop_mode
    ).toBe("SHADOW")
    expect(
      AssistantSettingsSchema.parse({
        ...DEFAULT_ASSISTANT_SETTINGS,
        native_tool_loop_mode: "ACTIVE"
      }).native_tool_loop_mode
    ).toBe("ACTIVE")
  })

  it("contains all core managed prompt keys in the registry", () => {
    expect(MANAGED_PROMPTS_REGISTRY[CUSTOMER_MESSAGE_INTENT_PROMPT_KEY]).toBeDefined()
    expect(MANAGED_PROMPTS_REGISTRY[KNOWLEDGE_ANSWER_PROMPT_KEY]).toBeDefined()
    expect(MANAGED_PROMPTS_REGISTRY[PRODUCT_ADVISOR_PROMPT_KEY]).toBeDefined()
    expect(MANAGED_PROMPTS_REGISTRY[CUSTOMER_SUPPORT_PROMPT_KEY]).toBeDefined()

    expect(
      MANAGED_PROMPTS_REGISTRY[CUSTOMER_MESSAGE_INTENT_PROMPT_KEY].default_system_prompt
    ).toContain("intent router")
    expect(MANAGED_PROMPTS_REGISTRY[KNOWLEDGE_ANSWER_PROMPT_KEY].default_system_prompt).toContain(
      "customer service advisor"
    )
  })
})
