import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import { executeCatalogRead } from "../modules/agent-operations/catalog-read-runtime"
import {
  buildProductAdvisorFallback,
  formatProductAdvisorReply,
} from "../modules/agent-operations/customer-product-advisor"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function verifyCustomerProductAdvisor({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [, memoryCount] = await service.listAndCountAgentConversationMemories(
    {},
    { take: 1 }
  )
  const firstReadStartedAt = Date.now()
  const catalogRead = await executeCatalogRead(
    container,
    { limit: 8, locale: "vi" },
    { tenant_id: "default" }
  )
  const first_read_ms = Date.now() - firstReadStartedAt
  const cachedReadStartedAt = Date.now()
  const cachedCatalogRead = await executeCatalogRead(
    container,
    { limit: 8, locale: "vi" },
    { tenant_id: "default" }
  )
  const cached_read_ms = Date.now() - cachedReadStartedAt
  const catalog = catalogRead.output
  assert.deepEqual(cachedCatalogRead.output, catalog)
  assert.equal(cachedCatalogRead.cache_status, "HIT")
  assert.equal(catalog.status, "READY")
  assert.ok(
    catalog.products.length > 0,
    "The live published catalog must contain at least one product."
  )
  const reply = formatProductAdvisorReply(
    buildProductAdvisorFallback(catalog, "vi"),
    catalog,
    "vi"
  )
  assert.ok(reply.product_ids.length > 0)
  assert.ok(
    catalog.products.every((product) =>
      product.variants.every(
        (variant) =>
          variant.available_quantity === null ||
          Number.isFinite(variant.available_quantity)
      )
    )
  )

  console.log(
    JSON.stringify(
      {
        passed: true,
        catalog_cache_reused: cachedCatalogRead.cache_status === "HIT",
        catalog_first_cache_status: catalogRead.cache_status,
        catalog_first_read_ms: first_read_ms,
        catalog_cached_read_ms: cached_read_ms,
        conversation_memory_records: memoryCount,
        product_count: catalog.products.length,
        products: catalog.products.map((product) => ({
          id: product.id,
          product_url: product.product_url,
          title: product.title,
          variants: product.variants.map((variant) => ({
            availability: variant.availability,
            available_quantity: variant.available_quantity,
            currency_code: variant.currency_code,
            price: variant.price,
            sku: variant.sku,
          })),
        })),
        reply_product_ids: reply.product_ids,
      },
      null,
      2
    )
  )
}
