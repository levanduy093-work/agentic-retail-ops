import type {
  ICachingModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  getTotalVariantAvailability,
  Modules,
  ProductStatus,
  QueryContext,
} from "@medusajs/framework/utils"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  CatalogProductResult,
  CatalogReadInput,
  CatalogReadOutput,
} from "./tools/catalog-tools"
import { buildTrustedProductUrl } from "./storefront-product-url"
import {
  buildCustomerAssistantCacheKey,
  CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS,
  normalizeCustomerCacheText,
  readCustomerAssistantCache,
  writeCustomerAssistantCache,
} from "./customer-assistant-cache"

export const CUSTOMER_CATALOG_READER_ACTOR_ID = "customer-product-advisor"

type QueryProductVariant = {
  calculated_price?: {
    calculated_amount?: number | null
    currency_code?: string | null
  } | null
  id: string
  manage_inventory?: boolean | null
  sku?: string | null
  title?: string | null
}

type QueryProduct = {
  categories?: Array<{ name?: string | null }> | null
  collection?: { title?: string | null } | null
  description?: string | null
  handle: string
  id: string
  subtitle?: string | null
  thumbnail?: string | null
  title: string
  variants?: QueryProductVariant[] | null
}

function toCatalogProduct(
  product: QueryProduct,
  availability: Record<string, { availability?: number | null }>,
  context: { country_code: string; locale: "en" | "vi" }
): CatalogProductResult {
  return {
    category_names: (product.categories ?? []).flatMap((category) =>
      category.name ? [category.name] : []
    ),
    collection_title: product.collection?.title ?? null,
    description: product.description ?? null,
    handle: product.handle,
    id: product.id,
    subtitle: product.subtitle ?? null,
    thumbnail: product.thumbnail ?? null,
    title: product.title,
    product_url: buildTrustedProductUrl({
      country_code: context.country_code,
      environment: {
        CUSTOMER_STOREFRONT_BASE_URL:
          process.env.CUSTOMER_STOREFRONT_BASE_URL,
        NODE_ENV: process.env.NODE_ENV,
        STORE_CORS: process.env.STORE_CORS,
      },
      handle: product.handle,
      locale: context.locale,
    }),
    variants: (product.variants ?? []).map((variant) => {
      const manageInventory = variant.manage_inventory !== false
      const quantity = manageInventory
        ? Number(availability[variant.id]?.availability)
        : null
      const availableQuantity =
        quantity !== null && Number.isFinite(quantity) ? quantity : null

      return {
        availability: !manageInventory
          ? ("NOT_MANAGED" as const)
          : availableQuantity === null
            ? ("UNKNOWN" as const)
            : availableQuantity > 0
              ? ("IN_STOCK" as const)
              : ("OUT_OF_STOCK" as const),
        available_quantity: availableQuantity,
        currency_code:
          variant.calculated_price?.currency_code?.toLocaleLowerCase() ?? null,
        id: variant.id,
        manage_inventory: manageInventory,
        price: variant.calculated_price?.calculated_amount ?? null,
        sku: variant.sku ?? null,
        title: variant.title?.trim() || "Default",
      }
    }),
  }
}

export async function executeCatalogRead(
  container: MedusaContainer,
  input: CatalogReadInput,
  context: { tenant_id?: string } = {}
) {
  let cacheStatus: "HIT" | "MISS" = "MISS"
  const result = await executeAgentTool<CatalogReadInput, CatalogReadOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: CUSTOMER_CATALOG_READER_ACTOR_ID,
        granted_permissions: ["agent_catalog:read"],
        mode: "DIRECT",
      },
      input,
      tool_name: "catalog.read",
      tool_version: "1.0.0",
    },
    async (parsed) => {
      const tenantId = context.tenant_id?.trim() || "default"
      const cacheKey = buildCustomerAssistantCacheKey("catalog", {
        limit: parsed.limit,
        locale: parsed.locale,
        query: normalizeCustomerCacheText(parsed.query ?? ""),
        storefront_origin:
          process.env.CUSTOMER_STOREFRONT_BASE_URL?.trim() ?? "",
        tenant_id: tenantId,
      })
      const caching = container.resolve<ICachingModuleService>(Modules.CACHING)
      const cached = await readCustomerAssistantCache(
        caching,
        cacheKey,
        (value) => {
          const result = CatalogReadOutput.safeParse(value)
          return result.success ? result.data : null
        }
      )
      if (cached) {
        cacheStatus = "HIT"
        return cached
      }

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({
        entity: "region",
        fields: ["id", "currency_code", "countries.iso_2"],
        pagination: { skip: 0, take: 20 },
      })
      const preferredCurrency = parsed.locale === "vi" ? "vnd" : "usd"
      const region =
        regions.find(
          (candidate: { currency_code?: string | null }) =>
            candidate.currency_code?.toLocaleLowerCase() === preferredCurrency
        ) ?? regions[0]
      const pricingContext = QueryContext({
        currency_code: region?.currency_code ?? preferredCurrency,
        region_id: region?.id,
      })
      const countryCode =
        region?.countries?.[0]?.iso_2?.toLocaleLowerCase() ??
        (parsed.locale === "vi" ? "vn" : "us")
      const filters: Record<string, unknown> = {
        status: ProductStatus.PUBLISHED,
      }
      if (parsed.query) filters.q = parsed.query

      const { data, metadata } = await query.graph({
        context: {
          variants: { calculated_price: pricingContext },
        },
        entity: "product",
        fields: [
          "id",
          "title",
          "subtitle",
          "description",
          "handle",
          "thumbnail",
          "collection.title",
          "categories.name",
          "variants.id",
          "variants.title",
          "variants.sku",
          "variants.manage_inventory",
          "variants.calculated_price.*",
        ],
        filters,
        pagination: {
          order: { created_at: "DESC" },
          skip: 0,
          take: Math.min(Math.max(parsed.limit * 8, 50), 100),
        },
      })
      const products = data as QueryProduct[]
      const variantIds = products.flatMap((product) =>
        (product.variants ?? []).map((variant) => variant.id)
      )
      const availability = variantIds.length
        ? await getTotalVariantAvailability(query, { variant_ids: variantIds })
        : {}

      const rankedProducts = products
        .map((product) =>
          toCatalogProduct(product, availability, {
            country_code: countryCode,
            locale: parsed.locale,
          })
        )
        .sort((left, right) => {
          const stockRank = (product: CatalogProductResult) =>
            product.variants.some(
              (variant) => variant.availability === "IN_STOCK"
            )
              ? 0
              : product.variants.some(
                    (variant) => variant.availability === "NOT_MANAGED"
                  )
                ? 1
                : 2
          return stockRank(left) - stockRank(right)
        })
        .slice(0, parsed.limit)

      const output = CatalogReadOutput.parse({
        products: rankedProducts,
        query: parsed.query ?? null,
        status: "READY",
        total_count: metadata?.count ?? products.length,
      })
      await writeCustomerAssistantCache(caching, {
        key: cacheKey,
        tags: [
          "customer-assistant:catalog",
          `customer-assistant:tenant:${tenantId}`,
        ],
        ttl: CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.catalog,
        value: output,
      })
      return output
    }
  )
  return { ...result, cache_status: cacheStatus }
}
