import { KnowledgeAnswer } from "./knowledge-answer"
import {
  CustomerCatalogSnapshot,
  extractCustomerProductPreferences,
} from "./customer-product-advisor"
import {
  executeCatalogFilter,
  executeStockCheck,
} from "./customer-dynamic-tools"
import { KnowledgeSearchOutput } from "./tools/platform-read-tools"
import { analyzeCustomerSentiment, SentimentAnalysisResult } from "./customer-sentiment-analyzer"

export type CustomerReActInput = {
  catalog?: { products: unknown[] }
  conversation_memory?: string | null
  knowledge?: KnowledgeSearchOutput
  locale: "en" | "vi"
  question: string
  recent_messages?: Array<{ body: string; direction: string }>
  tenant_id?: string
}

export type HybridIntentKind =
  | "PRODUCT_AND_SHIPPING"
  | "PRODUCT_AND_POLICY"
  | "PRODUCT_AND_SIZING"
  | "STANDARD"

export type CustomerSupportToolTrace = {
  input: Record<string, unknown>
  output: Record<string, unknown>
  tool_name: "catalog.filter" | "catalog.variant-stock"
}

export type CustomerSupportToolLoopResult = {
  catalog: CustomerCatalogSnapshot
  trace: CustomerSupportToolTrace[]
}

export function runCustomerSupportReadToolLoop(input: {
  catalog: CustomerCatalogSnapshot
  question: string
  recent_messages?: Array<{ body: string; direction?: string }>
}): CustomerSupportToolLoopResult {
  if (input.catalog.status !== "READY") {
    return { catalog: input.catalog, trace: [] }
  }

  const preferences = extractCustomerProductPreferences(
    input.question,
    input.recent_messages
  )
  const filterInput = {
    max_price: preferences.budget_max,
    query: preferences.product_query ?? input.question.slice(0, 160),
    size: preferences.size,
  }
  const products = executeCatalogFilter(input.catalog, filterInput).slice(0, 6)
  const trace: CustomerSupportToolTrace[] = [
    {
      input: filterInput,
      output: {
        product_ids: products.map((product) => product.id),
        result_count: products.length,
      },
      tool_name: "catalog.filter",
    },
  ]

  for (const product of products.slice(0, 3)) {
    const stockInput = {
      product_id: product.id,
      size: preferences.size,
    }
    const stock = executeStockCheck(input.catalog, stockInput)
    trace.push({
      input: stockInput,
      output: stock,
      tool_name: "catalog.variant-stock",
    })
  }

  return {
    catalog: {
      ...input.catalog,
      products,
      total_count: products.length,
    },
    trace,
  }
}

export function detectHybridIntent(
  question: string,
  catalog?: { products: unknown[] },
  knowledge?: KnowledgeSearchOutput
): HybridIntentKind {
  const normalized = question.normalize("NFKC").toLocaleLowerCase()

  const hasProductQuery =
    Boolean(catalog?.products && catalog.products.length > 0) ||
    /(?:áo|quần|váy|đầm|giày|dép|túi|mẫu|size|mặc|outfit|phối đồ)/iu.test(
      normalized
    )

  const hasShippingQuery =
    /(?:ship|giao hàng|vận chuyển|phí ship|bao lâu|khi nào nhận|hà nội|hồ chí minh|sài gòn|đà nẵng|quận|tỉnh)/iu.test(
      normalized
    )

  const hasPolicyQuery =
    /(?:đổi trả|trả hàng|hoàn tiền|bảo hành|voucher|mã giảm|thanh toán|cod)/iu.test(
      normalized
    )

  const hasSizingQuery =
    /(?:\d{1,3}\s*(?:cm|m)\b|\d{1,3}\s*kg\b|chiều cao|cân nặng|nặng|cao|vừa không)/iu.test(
      normalized
    )

  if (hasProductQuery && hasShippingQuery) return "PRODUCT_AND_SHIPPING"
  if (hasProductQuery && hasPolicyQuery) return "PRODUCT_AND_POLICY"
  if (hasProductQuery && hasSizingQuery) return "PRODUCT_AND_SIZING"
  return "STANDARD"
}

export function synthesizeHybridAnswer(
  input: CustomerReActInput,
  productAdviceAnswer: KnowledgeAnswer,
  knowledgeAnswer?: KnowledgeAnswer
): KnowledgeAnswer {
  if (!knowledgeAnswer || !knowledgeAnswer.body) {
    return productAdviceAnswer
  }

  const locale = input.locale || "vi"
  let combinedBody = ""

  if (locale === "vi") {
    combinedBody = `${productAdviceAnswer.body.trim()}\n\n📌 Về thông tin bạn hỏi thêm: ${knowledgeAnswer.body.trim()}`
  } else {
    combinedBody = `${productAdviceAnswer.body.trim()}\n\n📌 Regarding your additional question: ${knowledgeAnswer.body.trim()}`
  }

  return {
    ...productAdviceAnswer,
    body: combinedBody,
    citations: [
      ...(productAdviceAnswer.citations || []),
      ...(knowledgeAnswer.citations || []),
    ],
    grounded: productAdviceAnswer.grounded || knowledgeAnswer.grounded,
  }
}

export function processSentimentGuard(
  message: string
): SentimentAnalysisResult {
  return analyzeCustomerSentiment(message)
}
