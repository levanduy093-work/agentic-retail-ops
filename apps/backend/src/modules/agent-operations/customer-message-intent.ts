import { z } from "@medusajs/framework/zod"

export const CUSTOMER_MESSAGE_INTENTS = [
  "SMALL_TALK",
  "CLARIFY",
  "PRODUCT_DISCOVERY",
  "STORE_QUESTION",
  "HUMAN_ACTION",
  "OUT_OF_SCOPE",
  "UNSAFE",
] as const

export type CustomerMessageIntent = (typeof CUSTOMER_MESSAGE_INTENTS)[number]

export const CustomerMessageIntentModelOutput = z.strictObject({
  confidence: z.number().min(0).max(1),
  intent: z.enum(CUSTOMER_MESSAGE_INTENTS),
  reason: z.string().trim().min(1).max(240),
})

export type CustomerMessageIntentResult = z.infer<
  typeof CustomerMessageIntentModelOutput
>


export function buildCustomerIntentReply(
  intent: "CLARIFY" | "SMALL_TALK",
  locale: "en" | "vi",
  addressedAsShop = false,
  customSettings?: {
    bot_role?: string
    brand_name?: string
    clarify_message_en?: string
    clarify_message_vi?: string
    greeting_message_en?: string
    greeting_message_vi?: string
  }
) {
  const brand = customSettings?.brand_name || "Synapse"
  const role = customSettings?.bot_role || "nhân viên CSKH"

  if (intent === "SMALL_TALK") {
    if (locale === "vi") {
      if (customSettings?.greeting_message_vi) {
        return customSettings.greeting_message_vi
      }
      return addressedAsShop
        ? `Dạ, sốp là ${role} của ${brand} đây. Bạn cần sốp hỗ trợ gì ạ?`
        : `Chào bạn, mình là ${role} của ${brand}. Bạn cần mình hỗ trợ gì ạ?`
    }
    return (
      customSettings?.greeting_message_en ||
      `Hello, I'm ${brand} customer support. How can I help you today?`
    )
  }

  if (locale === "vi") {
    if (customSettings?.clarify_message_vi) {
      return customSettings.clarify_message_vi
    }
    return addressedAsShop
      ? `Sốp là ${role} của ${brand} và sẵn sàng hỗ trợ. Bạn cho sốp biết cụ thể sản phẩm, đơn hàng hoặc vấn đề đang quan tâm nhé?`
      : `Mình là ${role} của ${brand} và sẵn sàng hỗ trợ. Bạn cho mình biết cụ thể sản phẩm, đơn hàng hoặc vấn đề đang quan tâm nhé?`
  }

  return (
    customSettings?.clarify_message_en ||
    "I'm ready to help. Could you tell me which product, order, or issue you need help with?"
  )
}

export function isCustomerAddressingShop(message: string) {
  return /(?:\bsốp\b|\bshop\b)/iu.test(message.normalize("NFKC"))
}

export function defaultCustomerMessageIntent(): CustomerMessageIntentResult {
  return {
    confidence: 0,
    intent: "STORE_QUESTION",
    reason: "Model routing unavailable; continue through governed knowledge checks.",
  }
}

export function resolveCustomerMessageIntent(
  result: CustomerMessageIntentResult
): CustomerMessageIntent {
  return result.intent === "HUMAN_ACTION" && result.confidence < 0.65
    ? "CLARIFY"
    : result.intent
}
