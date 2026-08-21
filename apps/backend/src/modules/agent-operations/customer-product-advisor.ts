import { z } from "@medusajs/framework/zod"
import {
  CatalogProductResult,
  CatalogReadOutput,
} from "./tools/catalog-tools"

export type CustomerCatalogSnapshot =
  | CatalogReadOutput
  | {
      products: []
      query: string | null
      status: "UNAVAILABLE"
      total_count: 0
    }

export type CustomerProductPreferences = {
  budget_flexible?: boolean
  budget_max?: number
  color?: string
  fit?: string
  product_query?: string
  size?: string
}

export const ProductAdvisorModelOutput = z.strictObject({
  follow_up_question: z.string().trim().min(1).max(220).nullable(),
  intro: z.string().trim().min(1).max(300),
  recommendations: z
    .array(
      z.strictObject({
        product_id: z.string().min(1),
        reason: z.string().trim().min(1).max(140),
      })
    )
    .max(3),
})

export type ProductAdvisorModelResult = z.infer<
  typeof ProductAdvisorModelOutput
>

export const PRODUCT_ADVISOR_PROMPT_KEY = "customer-support.product-advisor"
export const PRODUCT_ADVISOR_PROMPT_VERSION = "1.4.0"
export const PRODUCT_ADVISOR_MAX_TOKENS = 700
export const PRODUCT_ADVISOR_TIMEOUT_MS = 10_000
export const PRODUCT_ADVISOR_OUTPUT_SCHEMA = {
  additionalProperties: false,
  properties: {
    follow_up_question: {
      anyOf: [
        { maxLength: 300, minLength: 1, type: "string" },
        { type: "null" },
      ],
    },
    intro: { maxLength: 500, minLength: 1, type: "string" },
    recommendations: {
      items: {
        additionalProperties: false,
        properties: {
          product_id: { minLength: 1, type: "string" },
          reason: { maxLength: 200, minLength: 1, type: "string" },
        },
        required: ["product_id", "reason"],
        type: "object",
      },
      maxItems: 3,
      type: "array",
    },
  },
  required: ["intro", "recommendations", "follow_up_question"],
  type: "object",
}

export const PRODUCT_ADVISOR_SYSTEM_PROMPT = `You are a warm, helpful, fashion-savvy retail product advisor for the store. Speak naturally, politely, and warmly, just like an attentive in-store shopping consultant. In Vietnamese, refer to yourself naturally as "mình" (or "sốp" if the customer calls you "shop" or "sốp") and call the customer "bạn". Do NOT use repetitive boilerplate robotic greetings or repetitive self-introductions; instead, converse directly about the customer's shopping interest.

Style and Tone:
- Natural, enthusiastic, and empathetic conversational tone (like a real human shop assistant).
- Understand Vietnamese everyday chat, slang, and abbreviations (e.g. "chs" = đi chơi/outing, "đc" = được, "sz" = size, "k/ko" = không, "váy/đầm", "áo thun", "quần jeans", "đi date", "chốt đơn").
- When the customer asks for outfits for an occasion (e.g. đi chơi, đi tiệc, đi làm, dạo phố, du lịch), warmly introduce suitable styles and options.
- If products are available in the live catalog snapshot, recommend up to three matching product IDs with brief, appealing style reasons based on their real descriptions/variants (e.g. chất vải thoáng mát, form tôn dáng, dễ phối đồ).
- If no specific products match or the request is general, write a friendly, inviting intro explaining that the store has many trendy items and ask a helpful follow-up question (about their preferred style, fit, color, or size).
- Do not invent non-existent products, discounts, or policies.
- Return structured data matching the schema.

Few-shot Product Advisory Examples:
Example 1 (Outfit recommendation for outing):
Customer: "mình cần tìm áo đi chơi cuối tuần với bạn bè"
Response: {
  "intro": "Dạ cuối tuần đi cafe hoặc dạo phố cùng bạn bè thì diện các mẫu áo phông cotton form rộng hoặc polo năng động là chuẩn bài luôn bạn nha! Shop gợi ý cho bạn mẫu cực xinh này:",
  "recommendations": [
    {"product_id": "prod_1", "reason": "Chất cotton 100% thoáng mát, form unisex dễ phối với quần short hoặc jeans rất tôn dáng."}
  ],
  "follow_up_question": "Bạn thích tone màu sáng năng động hay gam màu trung tính basic để mình chọn thêm cho bạn nè?"
}

Example 2 (Sizing / fit advice):
Customer: "mình 1m70 nặng 65kg mặc size nào vừa sốp"
Response: {
  "intro": "Dạ với chiều cao 1m70 và cân nặng 65kg thì bạn mặc size L bên mình là vừa vặn, form áo lên dáng chuẩn đẹp luôn ạ!",
  "recommendations": [
    {"product_id": "prod_1", "reason": "Form áo đứng dáng, chất co giãn nhẹ mặc cả ngày rất thoải mái."}
  ],
  "follow_up_question": "Bạn thích mặc ôm vừa người hay muốn mặc rộng rãi thoải mái hơn chút xíu ạ?"
}`

const browsingPatterns = [
  /(bán gì|bán về (?:đồ )?gì|có gì bán|shop có gì|sốp có gì|cửa hàng có gì|danh mục|sản phẩm nào)/iu,
  /(tư vấn|gợi ý|đề xuất|recommend|suggest|looking for|need a)/iu,
  /(sản phẩm|product|áo|quần|váy|đầm|giày|dép|túi|phụ kiện|size|màu|nam|nữ|trẻ em)/iu,
  /(cái|mẫu|loại) (?:đầu|thứ|số)\s*\d+/iu,
]

const seasonalShoppingPattern =
  /(?:mùa )?đông|winter|giữ ấm|áo ấm|đồ ấm/iu

const shoppingRequestPattern =
  /(?:cần|muốn|định|tính)\s+(?:mua|tìm|xem|chọn)(?:\s+(?:đồ|quần áo|trang phục))?/iu

const productDiscoveryFollowUpPattern =
  /(?:năng động|lịch sự|thoải mái|cá tính|điệu đà|sporty|smart|relaxed|size\s*[a-z0-9]+|ngân sách|tầm\s*\d+|bao nhiêu cũng (?:được|đc)|không giới hạn|sao cũng (?:được|đc)|tùy|ống rộng|rộng rãi|form rộng|suông|ôm vừa|ôm sát|đen|trắng|xanh|đỏ|vàng|hồng|xám|ghi|nâu|be|kaki|polo|jeans|short|sơ mi|khoác|size|sz|cỡ)/iu

export function isPotentialProductRequest(message: string) {
  const normalized = message.normalize("NFKC").toLocaleLowerCase()
  return (
    browsingPatterns.some((pattern) => pattern.test(normalized)) ||
    seasonalShoppingPattern.test(normalized) ||
    shoppingRequestPattern.test(normalized)
  )
}

export function isProductDiscoveryFollowUp(message: string) {
  return productDiscoveryFollowUpPattern.test(
    message.normalize("NFKC").toLocaleLowerCase()
  )
}

function normalizeProductPreferenceText(message: string) {
  return message
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\bchs\b/giu, "chơi")
    .replace(/\b(?:ko|k|khum|hong|hông)\b/giu, "không")
    .replace(/\b(?:đc|dc)\b/giu, "được")
    .replace(/\b(?:sz|co)\b/giu, "size")
    .replace(/\b(?:đg|dg)\b/giu, "đang")
    .replace(/\b(?:ntn)\b/giu, "như thế nào")
    .replace(/[?!.,;:'"“”‘’()[\]{}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

const colorTerms = [
  "đen",
  "trắng",
  "xanh",
  "đỏ",
  "vàng",
  "hồng",
  "xám",
  "ghi",
  "be",
  "nâu",
  "tím",
  "cam",
  "black",
  "white",
  "blue",
  "navy",
  "gray",
  "grey",
  "beige",
  "pink",
]

function extractRequestedColor(normalized: string) {
  const match = normalized.match(
    new RegExp(`\\b(?:màu|tone|gam màu)?\\s*(${colorTerms.join("|")})\\b`, "iu")
  )
  return match?.[1]?.toLocaleLowerCase()
}

function extractBudgetPreference(normalized: string): {
  budget_flexible?: boolean
  budget_max?: number
} {
  const isFlexible =
    /(?:bao nhiêu cũng (?:được|đc)|không giới hạn|sao cũng (?:được|đc)|tùy ý|tùy shop|tùy sốp|thoải mái|bnhieu cũng (?:được|đc)|bn cũng (?:được|đc)|no limit|any budget|unlimited)/iu.test(
      normalized
    )
  if (isFlexible) {
    return { budget_flexible: true }
  }

  const match = normalized.match(
    /(?:ngân sách|tầm|khoảng|dưới|tối đa|không quá)\s*(\d{1,3}(?:[.,]\d{3})?|\d+(?:[.,]\d+)?)\s*(triệu|tr|nghìn|ngàn|k)?/iu
  )
  if (!match) return {}

  const numericText = match[1]
  const compactDigits = numericText.replace(/[^\d]/gu, "")
  const numericValue = Number(compactDigits)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return {}

  const unit = match[2]?.toLocaleLowerCase()
  if (unit === "triệu" || unit === "tr") return { budget_max: numericValue * 1_000_000 }
  if (unit === "nghìn" || unit === "ngàn" || unit === "k") {
    return { budget_max: numericValue * 1_000 }
  }
  if (/[.,]\d{3}$/u.test(numericText)) return { budget_max: numericValue }
  return { budget_max: numericValue < 1_000 ? numericValue * 1_000 : numericValue }
}

function extractRequestedSize(normalized: string) {
  const match = normalized.match(
    /\b(?:size|cỡ|co)\s*(xs|s|m|l|xl|xxl|2xl|3xl)\b/iu
  )
  return match?.[1]?.toLocaleUpperCase()
}

function extractRequestedFit(normalized: string) {
  const match = normalized.match(
    /(?:^|\s)(ống rộng|rộng rãi|suông|form rộng|oversize|relaxed|ôm vừa|ôm sát|slim|slim fit|regular|regular fit|body|vừa vặn)(?:\s|$)/iu
  )
  return match?.[1]?.toLocaleLowerCase()
}

function extractProductSearchPhrase(normalized: string) {
  const tokens = normalized.split(/\s+/u)
  const productTerms = new Set([
    "áo",
    "quần",
    "váy",
    "đầm",
    "giày",
    "dép",
    "túi",
    "phụ",
    "hoodie",
    "cardigan",
    "jeans",
    "polo",
    "crop",
    "khoác",
    "sơ",
    "mi",
    "blazer",
    "gile",
    "culottes",
    "short",
    "jogger",
  ])
  const conversationalStopTerms = new Set([
    "ạ", "ơi", "nè", "nha", "nhé", "nhỉ", "chứ", "thế", "được", "đc", "không", "k", "ko",
    "bạn", "cho", "có", "em", "mình", "shop", "sốp", "giúp", "tư", "vấn", "hỏi", "xem",
    "cần", "muốn", "mua", "tìm", "chọn", "lấy", "định", "tính",
    "nào", "gì", "để", "mặc", "hợp", "đi", "đẹp", "phối", "mix", "chuẩn", "cùng", "với",
    "ngân", "sách", "tầm", "khoảng", "dưới", "giá", "tiền", "size", "cỡ", "màu", "tone",
    "loại", "mẫu", "cái", "đồ", "kiểu", "bên", "nhiều", "khác", "thêm", "nữa", "này", "kia",
  ])
  const colorTermSet = new Set(colorTerms)

  const startIndex = tokens.findIndex((token) => productTerms.has(token))
  if (startIndex < 0) return undefined

  const phrase: string[] = []
  for (const token of tokens.slice(startIndex, startIndex + 5)) {
    if (
      conversationalStopTerms.has(token) ||
      colorTermSet.has(token) ||
      /^\d/u.test(token)
    ) {
      break
    }
    phrase.push(token)
  }

  return phrase.length ? phrase.join(" ") : undefined
}

export function extractSingleMessageProductPreferences(
  message: string
): CustomerProductPreferences {
  const normalized = normalizeProductPreferenceText(message)
  const budget = extractBudgetPreference(normalized)
  return {
    ...budget,
    color: extractRequestedColor(normalized),
    fit: extractRequestedFit(normalized),
    product_query: extractProductSearchPhrase(normalized),
    size: extractRequestedSize(normalized),
  }
}

export function extractCustomerProductPreferences(
  message: string,
  recentMessages?: Array<{ body: string; direction?: string }>
): CustomerProductPreferences {
  const current = extractSingleMessageProductPreferences(message)
  if (!recentMessages || !recentMessages.length) {
    return current
  }

  const accumulated: CustomerProductPreferences = { ...current }
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const item = recentMessages[i]
    if (item.direction && item.direction !== "INBOUND") continue
    const historical = extractSingleMessageProductPreferences(item.body)

    if (!accumulated.product_query && historical.product_query) {
      accumulated.product_query = historical.product_query
    }
    if (!accumulated.size && historical.size) {
      accumulated.size = historical.size
    }
    if (!accumulated.color && historical.color) {
      accumulated.color = historical.color
    }
    if (!accumulated.fit && historical.fit) {
      accumulated.fit = historical.fit
    }
    if (
      accumulated.budget_max === undefined &&
      accumulated.budget_flexible === undefined
    ) {
      if (historical.budget_max !== undefined) {
        accumulated.budget_max = historical.budget_max
      } else if (historical.budget_flexible) {
        accumulated.budget_flexible = true
      }
    }
  }

  return accumulated
}

export function shouldReadCatalogForCustomerMessage(
  message: string,
  priorInboundMessages: string[]
) {
  return (
    isPotentialProductRequest(message) ||
    (priorInboundMessages.some(isPotentialProductRequest) &&
      isProductDiscoveryFollowUp(message))
  )
}

export function extractCatalogSearchQuery(message: string) {
  const normalized = normalizeProductPreferenceText(message)
  if (
    /(bán gì|bán về (?:đồ )?gì|có gì bán|shop có gì|sốp có gì|cửa hàng có gì|danh mục)/iu.test(
      normalized
    ) ||
    /(cái|mẫu|loại) (?:đầu|thứ|số)\s*\d+/iu.test(normalized)
  ) {
    return undefined
  }

  return extractCustomerProductPreferences(message).product_query
}

export function extractRecentCatalogSearchQuery(
  messages: Array<{ body: string; direction: "INBOUND" | "OUTBOUND" }>
) {
  for (const message of messages) {
    if (message.direction !== "INBOUND") continue
    const query = extractCatalogSearchQuery(message.body)
    if (query) return query
  }
  return undefined
}

export function isCatalogOverviewRequest(message: string) {
  const normalized = message.normalize("NFKC").toLocaleLowerCase()
  return /(bán gì|bán về (?:đồ )?gì|có gì bán|shop có gì|sốp có gì|cửa hàng có gì|danh mục|sản phẩm nào)/iu.test(
    normalized
  )
}

function formatPrice(product: CatalogProductResult, locale: "en" | "vi") {
  const pricedVariant = product.variants.find(
    (variant) => variant.price !== null && variant.currency_code
  )
  if (!pricedVariant?.currency_code || pricedVariant.price === null) return null
  try {
    return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
      currency: pricedVariant.currency_code.toLocaleUpperCase(),
      maximumFractionDigits:
        pricedVariant.currency_code.toLocaleLowerCase() === "vnd" ? 0 : 2,
      style: "currency",
    }).format(pricedVariant.price)
  } catch {
    return `${pricedVariant.price} ${pricedVariant.currency_code.toLocaleUpperCase()}`
  }
}

function formatAvailability(product: CatalogProductResult, locale: "en" | "vi") {
  if (product.variants.some((variant) => variant.availability === "IN_STOCK")) {
    return locale === "vi" ? "còn hàng" : "in stock"
  }
  if (
    product.variants.length &&
    product.variants.every((variant) => variant.availability === "OUT_OF_STOCK")
  ) {
    return locale === "vi" ? "đang hết hàng" : "out of stock"
  }
  return locale === "vi" ? "cần chọn phiên bản để kiểm tra" : "select a variant to check"
}

function compactCustomerText(value: string, maximumLength: number) {
  const normalized = value.replace(/\s+/gu, " ").trim()
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, maximumLength - 1).trimEnd()}…`
}

export function isPublicCustomerUrl(value: string | null | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLocaleLowerCase()
    if (url.protocol !== "https:" || url.username || url.password) return false
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^127\./u.test(hostname) ||
      /^10\./u.test(hostname) ||
      /^192\.168\./u.test(hostname) ||
      /^169\.254\./u.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./u.test(hostname)
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

function formatMissingListVi(items: string[]): string {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} và ${items[1]}`
  return `${items.slice(0, -1).join(", ")} hoặc ${items[items.length - 1]}`
}

function buildDiscoveryQuestion(
  question: string,
  locale: "en" | "vi",
  customPreferences?: CustomerProductPreferences
) {
  const normalized = question.normalize("NFKC").toLocaleLowerCase()
  const preferences = customPreferences ?? extractCustomerProductPreferences(question)
  const advisor = vietnameseAdvisorReference(question)
  const seasonal = /(mùa đông|đồ đông|winter|giữ ấm|ấm)/iu.test(normalized)
  const hasBudget = Boolean(preferences.budget_max || preferences.budget_flexible)
  if (locale === "vi") {
    const missing: string[] = []
    if (!preferences.product_query) {
      missing.push(seasonal ? "áo khoác, áo len hay quần dài" : "loại đồ")
    }
    if (!preferences.size) missing.push("size")
    if (!hasBudget) missing.push("khoảng ngân sách")
    if (!missing.length) {
      if (preferences.fit && preferences.color) {
        return `Bạn muốn ${advisor} lọc thêm tiêu chí nào khác (như chất liệu, dịp mặc) không ạ?`
      }
      if (preferences.fit) {
        return `Bạn muốn ưu tiên gam màu nào để ${advisor} lọc sát hơn ạ?`
      }
      if (preferences.color) {
        return `Bạn muốn ưu tiên form mặc như ôm vừa hay rộng rãi thoải mái ạ?`
      }
      return `Bạn muốn ưu tiên màu nào hoặc form mặc như ôm vừa, rộng rãi để ${advisor} lọc sát hơn ạ?`
    }
    return `Bạn cho ${advisor} biết thêm ${formatMissingListVi(missing)} để ${advisor} lọc mẫu phù hợp nhất nhé?`
  }
  if (preferences.product_query && preferences.size && hasBudget) {
    return "Do you prefer a specific color or fit so I can narrow this down?"
  }
  return seasonal
    ? "Are you after a jacket, knitwear, or trousers, and what size and budget should I work with?"
    : "What type of item are you shopping for, what size do you wear, and what budget should I work with?"
}

function isCustomerAddressingShop(message: string) {
  return /(?:\bsốp\b|\bshop\b)/iu.test(message.normalize("NFKC"))
}

function vietnameseAdvisorReference(question: string) {
  return isCustomerAddressingShop(question) ? "sốp" : "mình"
}

function variantMatchesRequestedSize(
  variantTitle: string,
  requestedSize: string
) {
  return variantTitle
    .normalize("NFKC")
    .toLocaleUpperCase()
    .split(/[^A-Z0-9]+/u)
    .includes(requestedSize)
}

function hasRequestedSize(
  product: CatalogProductResult,
  requestedSize: string | undefined
) {
  return (
    !requestedSize ||
    product.variants.some((variant) =>
      variantMatchesRequestedSize(variant.title, requestedSize)
    )
  )
}

function hasAvailableRequestedSize(
  product: CatalogProductResult,
  requestedSize: string | undefined
) {
  return product.variants.some(
    (variant) =>
      variant.availability === "IN_STOCK" &&
      (!requestedSize || variantMatchesRequestedSize(variant.title, requestedSize))
  )
}

function getLowestPrice(product: CatalogProductResult) {
  const prices = product.variants
    .map((variant) => variant.price)
    .filter((price): price is number => price !== null)
  return prices.length ? Math.min(...prices) : undefined
}

function isWithinBudget(
  product: CatalogProductResult,
  budgetMaximum: number | undefined
) {
  if (!budgetMaximum) return true
  const price = getLowestPrice(product)
  return price !== undefined && price <= budgetMaximum
}

function matchesRequestedColor(product: CatalogProductResult, color?: string) {
  if (!color) return true
  const text = [
    product.title,
    product.subtitle,
    product.description,
    ...product.variants.map((v) => v.title),
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .toLowerCase()
  return text.includes(color.toLowerCase())
}

function matchesRequestedFit(product: CatalogProductResult, fit?: string) {
  if (!fit) return true
  const text = [
    product.title,
    product.subtitle,
    product.description,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .toLowerCase()
  return text.includes(fit.toLowerCase())
}

function rankCatalogProducts(
  products: CatalogProductResult[],
  preferences: CustomerProductPreferences
) {
  return [...products].sort((left, right) => {
    const comparisons = [
      Number(matchesRequestedFit(right, preferences.fit)) -
        Number(matchesRequestedFit(left, preferences.fit)),
      Number(matchesRequestedColor(right, preferences.color)) -
        Number(matchesRequestedColor(left, preferences.color)),
      Number(hasAvailableRequestedSize(right, preferences.size)) -
        Number(hasAvailableRequestedSize(left, preferences.size)),
      Number(hasRequestedSize(right, preferences.size)) -
        Number(hasRequestedSize(left, preferences.size)),
      Number(isWithinBudget(right, preferences.budget_max)) -
        Number(isWithinBudget(left, preferences.budget_max)),
      Number(
        right.variants.some((variant) => variant.availability === "IN_STOCK")
      ) -
        Number(
          left.variants.some((variant) => variant.availability === "IN_STOCK")
        ),
      (left.variants[0]?.price ?? Number.MAX_SAFE_INTEGER) -
        (right.variants[0]?.price ?? Number.MAX_SAFE_INTEGER),
    ]

    for (const comparison of comparisons) {
      if (comparison !== 0) return comparison
    }
    return left.title.localeCompare(right.title)
  })
}

function buildRecommendationReason(
  product: CatalogProductResult,
  preferences: CustomerProductPreferences,
  locale: "en" | "vi"
) {
  const matchesSize = hasAvailableRequestedSize(product, preferences.size)
  const matchesBudget = isWithinBudget(product, preferences.budget_max)
  const price = formatPrice(product, locale)
  if (locale === "vi") {
    const facts = [
      preferences.size && matchesSize ? `có biến thể size ${preferences.size}` : null,
      price ? `giá từ ${price}` : null,
      matchesBudget && preferences.budget_max ? "nằm trong ngân sách bạn nêu" : null,
      product.variants.some((variant) => variant.availability === "IN_STOCK")
        ? "đang còn hàng"
        : null,
    ].filter(Boolean)
    return facts.length
      ? `Mẫu ${facts.join(", ")}.`
      : "Mẫu có trong catalog của Synapse."
  }
  const facts = [
    preferences.size && matchesSize ? `has an in-stock ${preferences.size} variant` : null,
    price ? `from ${price}` : null,
    matchesBudget && preferences.budget_max ? "within the stated budget" : null,
  ].filter(Boolean)
  return facts.length
    ? `This option ${facts.join(", ")}.`
    : "This item is listed in the Synapse catalog."
}

export function buildCatalogOverviewReply(
  catalog: CustomerCatalogSnapshot,
  locale: "en" | "vi",
  question = ""
) {
  if (catalog.status === "UNAVAILABLE" || !catalog.products.length) {
    return {
      body:
        locale === "vi"
          ? "Hiện tại bên mình có nhiều sản phẩm thời trang như áo thun, áo sơ mi, áo khoác và phụ kiện. Bạn muốn tìm đồ nam hay nữ, hoặc đang cần tìm mẫu cụ thể nào để mình hỗ trợ nhé?"
          : "We carry tops, shirts, outerwear, and accessories. Are you looking for men's, women's, or a specific item?",
      product_ids: [],
    }
  }
  const categories = [
    ...new Set(
      catalog.products.flatMap((product) => product.category_names).filter(Boolean)
    ),
  ].slice(0, 4)
  const categoryText = categories.join(", ")
  const advisor = vietnameseAdvisorReference(question)
  return {
    body:
      locale === "vi"
        ? `${advisor === "sốp" ? "Sốp" : "Hiện tại bên mình"} đang bán các mặt hàng thời trang${categoryText ? ` thuộc nhóm ${categoryText}` : " trong catalog"}. ${advisor === "sốp" ? "Sốp" : "Mình"} có thể lọc theo nhu cầu, size, phong cách và ngân sách để chọn mẫu hợp với bạn hơn.\n\nBạn đang muốn mua áo, quần hay phụ kiện; dùng đi làm, đi chơi hay mặc hằng ngày ạ?`
        : `We sell fashion items${categoryText ? ` across ${categoryText}` : " in our catalog"}. I can narrow them by use, size, style, and budget.\n\nAre you shopping for a top, bottoms, or an accessory, and is it for work, going out, or everyday wear?`,
    product_ids: [],
  }
}

export function buildProductAdvisorFallback(
  catalog: CustomerCatalogSnapshot,
  locale: "en" | "vi",
  question = "",
  customPreferences?: CustomerProductPreferences
): ProductAdvisorModelResult {
  const preferences = customPreferences ?? extractCustomerProductPreferences(question)
  const advisor = vietnameseAdvisorReference(question)
  const advisorCapitalized = advisor === "sốp" ? "Sốp" : "Mình"
  if (catalog.status === "UNAVAILABLE") {
    return {
      follow_up_question: buildDiscoveryQuestion(question, locale, preferences),
      intro:
        locale === "vi"
          ? `${advisorCapitalized} cần thêm một chút thông tin để chọn mẫu phù hợp cho bạn.`
          : "I'm still here to help you find something that suits you.",
      recommendations: [],
    }
  }
  if (!catalog.products.length) {
    return {
      follow_up_question: buildDiscoveryQuestion(question, locale, preferences),
      intro:
        locale === "vi"
          ? `Dạ ${advisor} có nhiều mẫu thời trang đang sẵn hàng.`
          : "We have a variety of fashion items and I'm happy to help you find the right one!",
      recommendations: [],
    }
  }
  const rankedProducts = rankCatalogProducts(catalog.products, preferences)
  const allManagedVariantsOutOfStock = catalog.products.every(
    (product) =>
      product.variants.length > 0 &&
      product.variants.every(
        (variant) => variant.availability === "OUT_OF_STOCK"
      )
  )
  const hasBudget = Boolean(preferences.budget_max || preferences.budget_flexible)
  return {
    follow_up_question:
      allManagedVariantsOutOfStock && locale === "vi"
        ? `Các mẫu này hiện chưa còn tồn khả dụng. Bạn muốn ${advisor} ghi nhận nhu cầu mẫu nào để nhân viên kiểm tra lịch nhập thêm không ạ?`
        : allManagedVariantsOutOfStock
          ? "These items have no available stock right now. Which one should staff check for a restock update?"
          : locale === "vi"
        ? `Bạn ưng mẫu nào trong các mẫu này, hoặc muốn ${advisor} tư vấn thêm màu/form khác không nè?`
        : "Which one do you like, or would you like me to check other colors or styles?",
    intro:
      allManagedVariantsOutOfStock && locale === "vi"
        ? `${advisorCapitalized} vừa kiểm tra catalog và tìm thấy các mẫu dưới đây, nhưng tồn kho khả dụng hiện đều bằng 0:`
        : allManagedVariantsOutOfStock
          ? "I found these catalog items, but their available stock is currently zero:"
          : locale === "vi"
        ? `Dạ ${advisor} gợi ý cho bạn các mẫu ${preferences.product_query || "thời trang"} cực xinh và hợp gu bên mình đây ạ:`
        : "Absolutely! I checked the live catalog and picked a few options:",
    recommendations: rankedProducts
      .slice(0, allManagedVariantsOutOfStock ? 2 : 3)
      .map((product) => ({
        product_id: product.id,
        reason:
          allManagedVariantsOutOfStock && locale === "vi"
            ? "Mẫu có trong catalog nhưng hiện chưa còn tồn khả dụng."
            : allManagedVariantsOutOfStock
              ? "This item is listed, but it currently has no available stock."
              : locale === "vi"
                ? buildRecommendationReason(product, preferences, locale)
                : "This item is currently listed in the store catalog.",
      })),
  }
}

export function formatProductAdvisorReply(
  output: ProductAdvisorModelResult,
  catalog: CustomerCatalogSnapshot,
  locale: "en" | "vi"
) {
  const productList: CatalogProductResult[] = catalog.products
  const products = new Map<string, CatalogProductResult>(
    productList.map((product) => [product.id, product] as const)
  )
  const uniqueIds = new Set<string>()
  const recommendations = output.recommendations.flatMap((recommendation) => {
    const product = products.get(recommendation.product_id)
    if (!product || uniqueIds.has(product.id)) return []
    uniqueIds.add(product.id)
    const price = formatPrice(product, locale)
    const status = formatAvailability(product, locale)
    const facts = [price, status].filter(Boolean).join(" · ")
    const verifiedLink = isPublicCustomerUrl(product.product_url)
      ? `\n${locale === "vi" ? "Xem sản phẩm" : "View product"}: ${product.product_url}`
      : ""
    return [
      `• ${product.title}${facts ? ` — ${facts}` : ""}\n${compactCustomerText(recommendation.reason, 140)}${verifiedLink}`,
    ]
  })
  const parts = [
    compactCustomerText(output.intro, 300),
    recommendations.join("\n\n"),
    output.follow_up_question
      ? compactCustomerText(output.follow_up_question, 220)
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  return {
    body: parts,
    product_ids: [...uniqueIds],
  }
}

export function resolveProductAdvisorModelOutput(
  output: ProductAdvisorModelResult,
  catalog: CustomerCatalogSnapshot,
  locale: "en" | "vi",
  question = "",
  customPreferences?: CustomerProductPreferences
) {
  const availableIds = new Set(catalog.products.map((product) => product.id))
  const recommendations = output.recommendations.filter((recommendation) =>
    availableIds.has(recommendation.product_id)
  )
  const productsById = new Map(
    catalog.products.map((product) => [product.id, product] as const)
  )
  const allRecommendationsOutOfStock =
    recommendations.length > 0 &&
    recommendations.every((recommendation) => {
      const product = productsById.get(recommendation.product_id)
      return Boolean(
        product?.variants.length &&
          product.variants.every(
            (variant) => variant.availability === "OUT_OF_STOCK"
          )
      )
    })
  const boundedRecommendations = allRecommendationsOutOfStock
    ? recommendations.slice(0, 2)
    : recommendations
  const preferences = customPreferences ?? extractCustomerProductPreferences(question)
  const hasBudget = Boolean(preferences.budget_max || preferences.budget_flexible)
  const repeatsKnownPreference = Boolean(
    preferences.product_query &&
      preferences.size &&
      hasBudget &&
      output.follow_up_question &&
      /(?:loại đồ|size gì|size nào|ngân sách.*bao nhiêu|budget|what type of item|what size)/iu.test(
        output.follow_up_question
      )
  )
  const safeOutput = boundedRecommendations.length
    ? {
        ...output,
        follow_up_question: repeatsKnownPreference
          ? buildDiscoveryQuestion(question, locale, preferences)
          : output.follow_up_question,
        recommendations: boundedRecommendations,
      }
    : buildProductAdvisorFallback(catalog, locale, question, preferences)
  return formatProductAdvisorReply(safeOutput, catalog, locale)
}
