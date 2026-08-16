export const CUSTOMER_PREFERENCE_EXPIRY_DAYS = {
  CONFIRMED: 180,
  CUSTOMER_STATED: 90,
} as const

export type CustomerPreferenceCandidate = {
  preference_type: "SIZE"
  value: string
  status: "CUSTOMER_STATED" | "CONFIRMED"
}

export function extractExplicitCustomerPreferences(
  message: string
): CustomerPreferenceCandidate[] {
  const normalized = message.normalize("NFKC")
  const sizeMatch = normalized.match(
    /(?:\bsize\s*|\bcỡ\s*|\bmặc\s+)(xs|s|m|l|xl|xxl)\b/iu
  )
  if (!sizeMatch?.[1]) return []

  const value = sizeMatch[1].toUpperCase()
  const status =
    /\b(?:vẫn|đúng|xác nhận|thường)\b/iu.test(normalized) ||
    /thường\s+mặc/iu.test(normalized)
      ? "CONFIRMED"
      : "CUSTOMER_STATED"

  return [{ preference_type: "SIZE", status, value }]
}

export function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export function formatCustomerProfilePreferences(
  preferences: Array<{
    preference_type: string
    status: string
    value: string
    expires_at: Date | string
  }>
) {
  return preferences
    .filter((preference) => preference.preference_type === "SIZE")
    .map((preference) => {
      const label =
        preference.status === "CONFIRMED" ? "đã xác nhận" : "khách đã nêu"
      const expiry = new Date(preference.expires_at).toLocaleDateString("vi-VN")
      return `Size ${preference.value} (${label}, hết hạn ${expiry})`
    })
}
