import {
  AssistantSettingsSchema,
  DEFAULT_ASSISTANT_SETTINGS,
  MANAGED_PROMPTS_REGISTRY
} from "../assistant-settings"
import { KNOWLEDGE_ANSWER_PROMPT_KEY } from "../knowledge-answer"
import { PRODUCT_ADVISOR_PROMPT_KEY } from "../customer-product-advisor"
import { CUSTOMER_SUPPORT_PROMPT_KEY } from "../customer-support-prompt"
import { CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY } from "../customer-support-orchestrator"
import { CONVERSATION_MEMORY_PROMPT_KEY } from "../conversation-memory"

describe("assistant settings and managed prompts registry", () => {
  it("validates default assistant settings schema", () => {
    const parsed = AssistantSettingsSchema.parse(DEFAULT_ASSISTANT_SETTINGS)
    expect(parsed.brand_name).toBe("Synapse")
    expect(parsed.bot_role).toBe("nhân viên CSKH")
    expect(parsed.greeting_message_vi).toContain("Synapse")
    expect(parsed.native_tool_loop_mode).toBe("ACTIVE")
    expect(parsed.review_ack_message_vi).toContain("shop cần kiểm tra lại")
    expect(parsed.store_specialty).toBe("Sản phẩm bán lẻ đa ngành")
    expect(parsed.advisor_tone).toContain("Nhiệt tình")
    expect(parsed.few_shot_examples).toEqual([])
  })

  it("supports customizing brand name and tone", () => {
    const custom = {
      advisor_tone: "Thân thiện và hài hước",
      brand_name: "Duy Fashion",
      bot_role: "chuyên viên tư vấn",
      few_shot_examples: [
        {
          advice_intro: "Dạ em gợi ý cho bạn mẫu này cực hot:",
          customer_query: "Tìm áo thun",
          follow_up_question: "Bạn thích màu sáng hay tối ạ?",
          product_reason: "Chất cotton mềm mát"
        }
      ],
      greeting_message_vi: "Dạ em chào anh/chị, em là tư vấn viên của Duy Fashion ạ!",
      store_specialty: "Thời trang Unisex"
    }
    const merged = AssistantSettingsSchema.parse({
      ...DEFAULT_ASSISTANT_SETTINGS,
      ...custom
    })
    expect(merged.brand_name).toBe("Duy Fashion")
    expect(merged.bot_role).toBe("chuyên viên tư vấn")
    expect(merged.store_specialty).toBe("Thời trang Unisex")
    expect(merged.few_shot_examples).toHaveLength(1)
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
    expect(MANAGED_PROMPTS_REGISTRY[KNOWLEDGE_ANSWER_PROMPT_KEY]).toBeDefined()
    expect(MANAGED_PROMPTS_REGISTRY[PRODUCT_ADVISOR_PROMPT_KEY]).toBeDefined()
    expect(MANAGED_PROMPTS_REGISTRY[CUSTOMER_SUPPORT_PROMPT_KEY]).toBeDefined()
    expect(MANAGED_PROMPTS_REGISTRY[CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY]).toBeDefined()
    expect(MANAGED_PROMPTS_REGISTRY[CONVERSATION_MEMORY_PROMPT_KEY]).toBeDefined()

    expect(MANAGED_PROMPTS_REGISTRY[KNOWLEDGE_ANSWER_PROMPT_KEY].default_system_prompt).toContain(
      "customer service advisor"
    )
  })
})
