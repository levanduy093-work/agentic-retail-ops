import { z } from "@medusajs/framework/zod"
import { CatalogProductResult, CatalogReadOutput } from "./tools/catalog-tools"
import { KnowledgeSearchOutput } from "./tools/platform-read-tools"

export const SearchCatalogToolInput = z.strictObject({
  category: z.string().trim().optional(),
  color: z.string().trim().optional(),
  max_price: z.number().positive().optional(),
  min_price: z.number().nonnegative().optional(),
  query: z.string().trim().min(1).max(160),
  size: z.string().trim().optional(),
})

export const CheckVariantStockToolInput = z.strictObject({
  color: z.string().trim().optional(),
  product_id: z.string().min(1),
  size: z.string().trim().optional(),
})

export const LookupPolicyFaqToolInput = z.strictObject({
  query: z.string().trim().min(1).max(200),
  topic: z.enum([
    "DELIVERY",
    "RETURNS_EXCHANGES",
    "WARRANTY",
    "PAYMENT_METHODS",
    "PROMOTIONS",
    "GENERAL",
  ]),
})

export type SearchCatalogToolInput = z.infer<typeof SearchCatalogToolInput>
export type CheckVariantStockToolInput = z.infer<
  typeof CheckVariantStockToolInput
>
export type LookupPolicyFaqToolInput = z.infer<typeof LookupPolicyFaqToolInput>

export type DynamicToolResult<T = unknown> = {
  data: T
  error?: string
  success: boolean
}

export function executeCatalogFilter(
  catalog: CatalogReadOutput,
  input: SearchCatalogToolInput
): CatalogProductResult[] {
  return catalog.products.filter((product) => {
    const searchableText = [
      product.category_names.join(" "),
      product.collection_title,
      product.description,
      product.handle,
      product.subtitle,
      product.title,
      ...product.variants.map((variant) => variant.title),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLocaleLowerCase()

    const queryTokens = input.query
      .toLocaleLowerCase()
      .split(/\s+/u)
      .filter((token) => token.length > 1)
    if (queryTokens.length && !queryTokens.every((token) => searchableText.includes(token))) {
      return false
    }

    if (input.category) {
      const matchCategory = product.category_names.some((cat) =>
        cat.toLowerCase().includes(input.category!.toLowerCase())
      )
      if (!matchCategory) return false
    }

    if (input.color && !searchableText.includes(input.color.toLocaleLowerCase())) {
      return false
    }

    if (
      input.size &&
      !product.variants.some((variant) =>
        variant.title.toLocaleLowerCase().includes(input.size!.toLocaleLowerCase())
      )
    ) {
      return false
    }

    if (input.min_price || input.max_price) {
      const hasMatchingPrice = product.variants.some((v) => {
        if (v.price === null) return false
        if (input.min_price && v.price < input.min_price) return false
        if (input.max_price && v.price > input.max_price) return false
        return true
      })
      if (!hasMatchingPrice) return false
    }

    return true
  })
}

export function executeStockCheck(
  catalog: CatalogReadOutput,
  input: CheckVariantStockToolInput
): {
  available_quantity: number | null
  in_stock: boolean
  product_title: string | null
  variant_title: string | null
} {
  const product = catalog.products.find((p) => p.id === input.product_id)
  if (!product) {
    return {
      available_quantity: 0,
      in_stock: false,
      product_title: null,
      variant_title: null,
    }
  }

  const matchingVariant = product.variants.find((v) => {
    if (input.size) {
      const matchSize = v.title
        .toLowerCase()
        .includes(input.size.toLowerCase())
      if (!matchSize) return false
    }
    return true
  })

  if (!matchingVariant) {
    const hasAnyInStock = product.variants.some(
      (v) => v.availability === "IN_STOCK"
    )
    return {
      available_quantity: hasAnyInStock ? 1 : 0,
      in_stock: hasAnyInStock,
      product_title: product.title,
      variant_title: null,
    }
  }

  return {
    available_quantity: matchingVariant.available_quantity,
    in_stock: matchingVariant.availability === "IN_STOCK",
    product_title: product.title,
    variant_title: matchingVariant.title,
  }
}

export function executePolicyFilter(
  knowledge: KnowledgeSearchOutput,
  input: LookupPolicyFaqToolInput
) {
  const queryTokens = input.query.toLowerCase().split(/\s+/u).filter(Boolean)
  const matchingResults = knowledge.results.filter((res) => {
    const text = (res.title + " " + res.excerpt).toLowerCase()
    return queryTokens.some((token) => text.includes(token))
  })

  return {
    results: matchingResults.length > 0 ? matchingResults : knowledge.results,
    total_candidates: matchingResults.length || knowledge.total_candidates,
  }
}
