export const CUSTOMER_PREFERENCE_EXPIRY_DAYS = {
  CONFIRMED: 180,
  CUSTOMER_STATED: 90,
} as const

export type CustomerPreferenceType = "SIZE" | "STYLE" | "MEASUREMENTS"

export type CustomerPreferenceCandidate = {
  preference_type: CustomerPreferenceType
  value: string
  status: "CUSTOMER_STATED" | "CONFIRMED"
}

export function extractExplicitCustomerPreferences(
  message: string
): CustomerPreferenceCandidate[] {
  const normalized = message.normalize("NFKC")
  const candidates: CustomerPreferenceCandidate[] = []

  const sizeMatch = normalized.match(
    /(?:\bsize\s*|\bcỡ\s*|\bmặc\s+)(xs|s|m|l|xl|xxl)\b/iu
  )
  if (sizeMatch?.[1]) {
    const value = sizeMatch[1].toUpperCase()
    const status =
      /\b(?:vẫn|đúng|xác nhận|thường)\b/iu.test(normalized) ||
      /thường\s+mặc/iu.test(normalized)
        ? "CONFIRMED"
        : "CUSTOMER_STATED"
    candidates.push({ preference_type: "SIZE", status, value })
  }

  const measurementMatch = normalized.match(
    /\b(1m\d{2}|cao\s*\d{2,3}(?:\s*cm)?)\b.*?\b(\d{2,3}\s*kg|nặng\s*\d{2,3})\b/iu
  )
  if (measurementMatch) {
    const val = `${measurementMatch[1].trim()} / ${measurementMatch[2].trim()}`
    candidates.push({
      preference_type: "MEASUREMENTS",
      status: "CUSTOMER_STATED",
      value: val,
    })
  }

  const styleMatch = normalized.match(
    /\b(?:gu|phong cách|thích|chuộng)\s+(streetwear|oversize|minimalism|tối giản|vintage|công sở|năng động|bánh bèo|nữ tính)\b/iu
  )
  if (styleMatch?.[1]) {
    candidates.push({
      preference_type: "STYLE",
      status: "CUSTOMER_STATED",
      value: styleMatch[1].toLowerCase(),
    })
  }

  return candidates
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
  const items: string[] = []

  for (const preference of preferences) {
    if (preference.preference_type === "SIZE") {
      const label =
        preference.status === "CONFIRMED" ? "đã xác nhận" : "khách đã nêu"
      const expiry = new Date(preference.expires_at).toLocaleDateString("vi-VN")
      items.push(`Size ${preference.value} (${label}, hết hạn ${expiry})`)
    } else if (preference.preference_type === "STYLE") {
      items.push(`Phong cách ưa thích: ${preference.value}`)
    } else if (preference.preference_type === "MEASUREMENTS") {
      items.push(`Số đo: ${preference.value}`)
    }
  }

  return items
}
