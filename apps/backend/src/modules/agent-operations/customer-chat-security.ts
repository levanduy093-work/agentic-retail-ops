export type CustomerChatSecurityConfig = {
  blocked_chat_ids: string[]
  burst_limit: number
  burst_window_seconds: number
  daily_limit: number
  global_burst_limit: number
  global_daily_limit: number
  max_message_characters: number
  max_open_escalations: number
  max_update_age_seconds: number
}

export type CustomerChatIngressDecision =
  | { allowed: true }
  | {
      allowed: false
      reason: "BLOCKED" | "CAPACITY_LIMIT" | "DAILY_LIMIT" | "MESSAGE_TOO_LONG" | "RATE_LIMITED" | "STALE_UPDATE"
    }

export const DEFAULT_CUSTOMER_CHAT_SECURITY: CustomerChatSecurityConfig = {
  blocked_chat_ids: [],
  burst_limit: 6,
  burst_window_seconds: 60,
  daily_limit: 100,
  global_burst_limit: 120,
  global_daily_limit: 5_000,
  max_message_characters: 2_000,
  max_open_escalations: 3,
  max_update_age_seconds: 300,
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback
}

export function normalizeCustomerChatSecurityConfig(
  value?: Partial<CustomerChatSecurityConfig> | null
): CustomerChatSecurityConfig {
  return {
    blocked_chat_ids: Array.isArray(value?.blocked_chat_ids)
      ? [...new Set(value.blocked_chat_ids.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))]
      : [],
    burst_limit: boundedInteger(value?.burst_limit, DEFAULT_CUSTOMER_CHAT_SECURITY.burst_limit, 1, 100),
    burst_window_seconds: boundedInteger(
      value?.burst_window_seconds,
      DEFAULT_CUSTOMER_CHAT_SECURITY.burst_window_seconds,
      10,
      3_600
    ),
    daily_limit: boundedInteger(value?.daily_limit, DEFAULT_CUSTOMER_CHAT_SECURITY.daily_limit, 1, 10_000),
    global_burst_limit: boundedInteger(
      value?.global_burst_limit,
      DEFAULT_CUSTOMER_CHAT_SECURITY.global_burst_limit,
      1,
      10_000
    ),
    global_daily_limit: boundedInteger(
      value?.global_daily_limit,
      DEFAULT_CUSTOMER_CHAT_SECURITY.global_daily_limit,
      1,
      100_000
    ),
    max_message_characters: boundedInteger(
      value?.max_message_characters,
      DEFAULT_CUSTOMER_CHAT_SECURITY.max_message_characters,
      50,
      10_000
    ),
    max_open_escalations: boundedInteger(
      value?.max_open_escalations,
      DEFAULT_CUSTOMER_CHAT_SECURITY.max_open_escalations,
      1,
      20
    ),
    max_update_age_seconds: boundedInteger(
      value?.max_update_age_seconds,
      DEFAULT_CUSTOMER_CHAT_SECURITY.max_update_age_seconds,
      30,
      86_400
    ),
  }
}

export function evaluateCustomerChatIngress(input: {
  chat_id: string
  config: CustomerChatSecurityConfig
  message_length: number
  now: Date
  recent_message_times: Array<Date | string>
  global_message_times?: Array<Date | string>
  update_date: Date
}): CustomerChatIngressDecision {
  if (input.config.blocked_chat_ids.includes(input.chat_id)) {
    return { allowed: false, reason: "BLOCKED" }
  }
  if (input.message_length > input.config.max_message_characters) {
    return { allowed: false, reason: "MESSAGE_TOO_LONG" }
  }
  const updateAge = input.now.getTime() - input.update_date.getTime()
  if (
    updateAge > input.config.max_update_age_seconds * 1_000 ||
    updateAge < -60_000
  ) {
    return { allowed: false, reason: "STALE_UPDATE" }
  }

  const dayStart = input.now.getTime() - 24 * 60 * 60 * 1_000
  const burstStart =
    input.now.getTime() - input.config.burst_window_seconds * 1_000
  let dailyCount = 0
  let burstCount = 0
  for (const occurredAt of input.recent_message_times) {
    const timestamp = new Date(occurredAt).getTime()
    if (!Number.isFinite(timestamp) || timestamp < dayStart) continue
    dailyCount += 1
    if (timestamp >= burstStart) burstCount += 1
  }
  if (dailyCount >= input.config.daily_limit) {
    return { allowed: false, reason: "DAILY_LIMIT" }
  }
  if (burstCount >= input.config.burst_limit) {
    return { allowed: false, reason: "RATE_LIMITED" }
  }
  let globalDailyCount = 0
  let globalBurstCount = 0
  for (const occurredAt of input.global_message_times ?? []) {
    const timestamp = new Date(occurredAt).getTime()
    if (!Number.isFinite(timestamp) || timestamp < dayStart) continue
    globalDailyCount += 1
    if (timestamp >= burstStart) globalBurstCount += 1
  }
  if (
    globalDailyCount >= input.config.global_daily_limit ||
    globalBurstCount >= input.config.global_burst_limit
  ) {
    return { allowed: false, reason: "CAPACITY_LIMIT" }
  }
  return { allowed: true }
}

const PROMPT_ATTACK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|system|developer)\s+instructions?/iu,
  /(reveal|show|print|repeat|leak)\s+(the\s+)?(system|developer)\s+(prompt|message|instructions?)/iu,
  /(execute|run|call)\s+(a\s+)?(tool|function|command|shell|sql)/iu,
  /(bypass|disable|override)\s+(the\s+)?(guardrails?|safety|policy|permissions?)/iu,
  /(grant|enable|elevate|add)\s+(?:me\s+)?(?:admin|inventory|privileged?|access)\s+(?:access|permissions?)/iu,
  /(api[ _-]?key|access token|secret key|password|mật khẩu|token truy cập)/iu,
  /bỏ\s+qua\s+(mọi\s+)?(hướng\s+dẫn|chỉ\s+thị|quy\s+tắc)/iu,
  /(tiết\s+lộ|hiển\s+thị|in\s+ra)\s+(system\s+)?prompt/iu,
  /(chạy|thực\s+thi|gọi)\s+(lệnh|tool|công\s+cụ|shell|sql)/iu,
  /(cấp|bật|nâng|thêm)\s+quyền|quyền\s+(quản trị|admin|kho)/iu,
]

export function isExplicitPromptAttack(value: string) {
  return PROMPT_ATTACK_PATTERNS.some((pattern) => pattern.test(value))
}

export function buildProfessionalScopeReply(locale: "en" | "vi") {
  return locale === "vi"
    ? "Mình có thể hỗ trợ về sản phẩm, đơn hàng, giao nhận, đổi trả và chính sách của cửa hàng. Bạn đang cần hỗ trợ nội dung nào trong các nhóm này?"
    : "I can help with the store's products, orders, delivery, returns, and policies. Which of these areas can I help you with?"
}
