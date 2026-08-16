import { z } from "@medusajs/framework/zod"
import {
  CUSTOMER_SUPPORT_DEFAULT_MAX_TOKENS,
  CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT,
  CUSTOMER_SUPPORT_PROMPT_KEY,
  CUSTOMER_SUPPORT_PROMPT_VERSION,
} from "./customer-support-prompt"
import {
  CUSTOMER_MESSAGE_INTENT_MAX_TOKENS,
  CUSTOMER_MESSAGE_INTENT_PROMPT_KEY,
  CUSTOMER_MESSAGE_INTENT_PROMPT_VERSION,
  CUSTOMER_MESSAGE_INTENT_SYSTEM_PROMPT,
} from "./customer-message-intent"
import {
  KNOWLEDGE_ANSWER_MAX_TOKENS,
  KNOWLEDGE_ANSWER_PROMPT_KEY,
  KNOWLEDGE_ANSWER_PROMPT_VERSION,
  KNOWLEDGE_ANSWER_SYSTEM_PROMPT,
} from "./knowledge-answer"
import {
  PRODUCT_ADVISOR_MAX_TOKENS,
  PRODUCT_ADVISOR_PROMPT_KEY,
  PRODUCT_ADVISOR_PROMPT_VERSION,
  PRODUCT_ADVISOR_SYSTEM_PROMPT,
} from "./customer-product-advisor"
import {
  CUSTOMER_CONVERSATION_MAX_TOKENS,
  CUSTOMER_CONVERSATION_PROMPT_KEY,
  CUSTOMER_CONVERSATION_PROMPT_VERSION,
  CUSTOMER_CONVERSATION_SYSTEM_PROMPT,
} from "./customer-conversation-responder"

export const ASSISTANT_SETTINGS_PROMPT_KEY = "customer-support.assistant-settings"
export const ASSISTANT_SETTINGS_VERSION = "1.0.0"

export const AssistantSettingsSchema = z.strictObject({
  bot_role: z.string().trim().min(1).max(100).default("nhân viên CSKH"),
  brand_name: z.string().trim().min(1).max(100).default("Synapse"),
  clarify_message_en: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default(
      "I'm ready to help. Could you tell me which product, order, or issue you need help with?"
    ),
  clarify_message_vi: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default(
      "Mình là nhân viên CSKH và sẵn sàng hỗ trợ. Bạn cho mình biết cụ thể sản phẩm, đơn hàng hoặc vấn đề đang quan tâm nhé?"
    ),
  greeting_message_en: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default("Hello, I'm customer support. How can I help you today?"),
  greeting_message_vi: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default("Chào bạn, mình là nhân viên CSKH. Bạn cần mình hỗ trợ gì ạ?"),
  review_ack_message_en: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default(
      "I will need to verify this information with our team to help you accurately. In the meantime, is there anything else regarding products, sizing, or orders I can help with?"
    ),
  review_ack_message_vi: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default(
      "Dạ thông tin này shop cần kiểm tra lại để hỗ trợ bạn chính xác nhất ạ. Trong lúc chờ, bạn có cần shop tư vấn thêm về sản phẩm, chọn size hay kiểm tra đơn hàng nào không nhé?"
    ),
})

export type AssistantSettings = z.infer<typeof AssistantSettingsSchema>

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  bot_role: "nhân viên CSKH",
  brand_name: "Synapse",
  clarify_message_en:
    "I'm ready to help. Could you tell me which product, order, or issue you need help with?",
  clarify_message_vi:
    "Mình là nhân viên CSKH của Synapse và sẵn sàng hỗ trợ. Bạn cho mình biết cụ thể sản phẩm, đơn hàng hoặc vấn đề đang quan tâm nhé?",
  greeting_message_en:
    "Hello, I'm Synapse customer support. How can I help you today?",
  greeting_message_vi:
    "Chào bạn, mình là nhân viên CSKH của Synapse. Bạn cần mình hỗ trợ gì ạ?",
  review_ack_message_en:
    "I will need to verify this information with our team to help you accurately. In the meantime, is there anything else regarding products, sizing, or orders I can help with?",
  review_ack_message_vi:
    "Dạ thông tin này shop cần kiểm tra lại để hỗ trợ bạn chính xác nhất ạ. Trong lúc chờ, bạn có cần shop tư vấn thêm về sản phẩm, chọn size hay kiểm tra đơn hàng nào không nhé?",
}

export type ManagedPromptMetadata = {
  default_max_tokens: number
  default_system_prompt: string
  description: string
  prompt_key: string
  title: string
  version: string
}

export const MANAGED_PROMPTS_REGISTRY: Record<string, ManagedPromptMetadata> = {
  [CUSTOMER_MESSAGE_INTENT_PROMPT_KEY]: {
    default_max_tokens: CUSTOMER_MESSAGE_INTENT_MAX_TOKENS,
    default_system_prompt: CUSTOMER_MESSAGE_INTENT_SYSTEM_PROMPT,
    description:
      "Hướng dẫn mô hình AI phân loại chính xác ý định khách hàng (Chào hỏi, Hỏi chính sách/RAG, Tư vấn sản phẩm, Yêu cầu hành động).",
    prompt_key: CUSTOMER_MESSAGE_INTENT_PROMPT_KEY,
    title: "Intent Router (Phân loại ý định LLM)",
    version: CUSTOMER_MESSAGE_INTENT_PROMPT_VERSION,
  },
  [KNOWLEDGE_ANSWER_PROMPT_KEY]: {
    default_max_tokens: KNOWLEDGE_ANSWER_MAX_TOKENS,
    default_system_prompt: KNOWLEDGE_ANSWER_SYSTEM_PROMPT,
    description:
      "Hướng dẫn mô hình AI tổng hợp câu trả lời dựa trên trích dẫn tài liệu đã duyệt, giọng điệu và cách xử lý khi thiếu thông tin.",
    prompt_key: KNOWLEDGE_ANSWER_PROMPT_KEY,
    title: "RAG Knowledge Q&A (Trả lời từ tài liệu tri thức)",
    version: KNOWLEDGE_ANSWER_PROMPT_VERSION,
  },
  [PRODUCT_ADVISOR_PROMPT_KEY]: {
    default_max_tokens: PRODUCT_ADVISOR_MAX_TOKENS,
    default_system_prompt: PRODUCT_ADVISOR_SYSTEM_PROMPT,
    description:
      "Hướng dẫn mô hình AI lọc và đề xuất sản phẩm theo sở thích, kích cỡ, ngân sách và mô tả của khách hàng.",
    prompt_key: PRODUCT_ADVISOR_PROMPT_KEY,
    title: "Product Advisor (Tư vấn gợi ý sản phẩm)",
    version: PRODUCT_ADVISOR_PROMPT_VERSION,
  },
  [CUSTOMER_SUPPORT_PROMPT_KEY]: {
    default_max_tokens: CUSTOMER_SUPPORT_DEFAULT_MAX_TOKENS,
    default_system_prompt: CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT,
    description:
      "System prompt tổng quan quy định danh tính và ranh giới bảo mật cho toàn bộ trợ lý CSKH.",
    prompt_key: CUSTOMER_SUPPORT_PROMPT_KEY,
    title: "Customer Support General (Trợ lý CSKH tổng quát)",
    version: CUSTOMER_SUPPORT_PROMPT_VERSION,
  },
  [CUSTOMER_CONVERSATION_PROMPT_KEY]: {
    default_max_tokens: CUSTOMER_CONVERSATION_MAX_TOKENS,
    default_system_prompt: CUSTOMER_CONVERSATION_SYSTEM_PROMPT,
    description:
      "Hướng dẫn mô hình AI phản hồi các câu chào hỏi, làm rõ thông tin và hội thoại thân mật tự nhiên với khách hàng.",
    prompt_key: CUSTOMER_CONVERSATION_PROMPT_KEY,
    title: "Small Talk & Clarify (Chào hỏi & Làm rõ hội thoại)",
    version: CUSTOMER_CONVERSATION_PROMPT_VERSION,
  },
}
