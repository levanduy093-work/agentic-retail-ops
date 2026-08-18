export function normalizeString(str?: unknown): string {
  if (!str) return ""
  return String(str).trim().toLowerCase().replace(/\s+/g, " ")
}

export function normalizePhoneNumber(phone?: unknown): string {
  if (!phone) return ""
  let clean = String(phone).replace(/[\s\-\.\(\)]/g, "")
  if (clean.startsWith("+84")) {
    clean = "0" + clean.slice(3)
  } else if (clean.startsWith("84") && clean.length >= 11) {
    clean = "0" + clean.slice(2)
  }
  return clean
}

export function isSameAddress(
  address1?: Record<string, unknown> | null,
  address2?: Record<string, unknown> | null
): boolean {
  if (!address1 || !address2) return false

  const fieldsToCompare = [
    "first_name",
    "last_name",
    "address_1",
    "company",
    "postal_code",
    "city",
    "country_code",
    "province",
  ]

  for (const field of fieldsToCompare) {
    const val1 = normalizeString(address1[field])
    const val2 = normalizeString(address2[field])
    if (val1 !== val2) {
      return false
    }
  }

  const phone1 = normalizePhoneNumber(address1.phone)
  const phone2 = normalizePhoneNumber(address2.phone)
  if (phone1 !== phone2) {
    return false
  }

  // If both have GHN metadata, verify they match
  const meta1 = address1.metadata as Record<string, unknown> | undefined
  const meta2 = address2.metadata as Record<string, unknown> | undefined
  if (meta1 && meta2) {
    if (
      meta1.ghn_ward_code &&
      meta2.ghn_ward_code &&
      String(meta1.ghn_ward_code) !== String(meta2.ghn_ward_code)
    ) {
      return false
    }
    if (
      meta1.ghn_district_id &&
      meta2.ghn_district_id &&
      Number(meta1.ghn_district_id) !== Number(meta2.ghn_district_id)
    ) {
      return false
    }
    if (
      meta1.ghn_province_id &&
      meta2.ghn_province_id &&
      Number(meta1.ghn_province_id) !== Number(meta2.ghn_province_id)
    ) {
      return false
    }
  }

  return true
}

export default function compareAddresses(
  address1?: Record<string, unknown> | null,
  address2?: Record<string, unknown> | null
): boolean {
  return isSameAddress(address1, address2)
}


