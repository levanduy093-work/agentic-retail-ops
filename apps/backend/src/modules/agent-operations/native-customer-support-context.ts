import type { CustomerCatalogSnapshot } from "./customer-product-advisor"
import type { CustomerOrderLookup } from "./customer-order-lookup"
import type { NativeToolLoopResult } from "./native-tool-loop"
import type { KnowledgeSearchOutput } from "./tools/platform-read-tools"
import type { FulfillmentReadOutput } from "./tools/fulfillment-tools"
import type { OrderReadOutput } from "./tools/order-tools"

export type NativeCustomerSupportContext = {
  catalog_snapshot?: CustomerCatalogSnapshot
  customer_order_lookup?: CustomerOrderLookup
  knowledge_snapshot?: KnowledgeSearchOutput
  route?: "PRODUCT_DISCOVERY" | "STORE_QUESTION"
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function extractNativeCustomerSupportContext(
  toolResults: NativeToolLoopResult["tool_results"]
): NativeCustomerSupportContext {
  const context: NativeCustomerSupportContext = {}

  for (const result of toolResults) {
    const output = asRecord(result.output)
    if (!output) continue

    if (
      result.name === "search_catalog" &&
      output.status === "READY" &&
      Array.isArray(output.products) &&
      typeof output.total_count === "number"
    ) {
      context.catalog_snapshot = output as CustomerCatalogSnapshot
    }

    if (
      result.name === "check_realtime_stock" &&
      typeof output.product_id === "string" &&
      Array.isArray(output.variants) &&
      context.catalog_snapshot
    ) {
      const product = context.catalog_snapshot.products.find(
        (candidate) => candidate.id === output.product_id
      )
      if (product && Array.isArray(product.variants)) {
        const liveVariants = new Map(
          output.variants.flatMap((candidate) => {
            const variant = asRecord(candidate)
            if (
              !variant ||
              typeof variant.id !== "string" ||
              typeof variant.availability !== "string"
            ) {
              return []
            }
            return [[variant.id, variant] as const]
          })
        )
        product.variants = product.variants.map((variant) => {
          const liveVariant = liveVariants.get(variant.id)
          if (!liveVariant) return variant
          const availableQuantity = liveVariant.available_quantity
          return {
            ...variant,
            availability: liveVariant.availability as typeof variant.availability,
            available_quantity:
              typeof availableQuantity === "number" || availableQuantity === null
                ? availableQuantity
                : variant.available_quantity,
          }
        })
      }
    }

    if (
      result.name === "search_knowledge_base" &&
      Array.isArray(output.results) &&
      typeof output.total_candidates === "number"
    ) {
      context.knowledge_snapshot = output as KnowledgeSearchOutput
    }

    if (
      result.name === "check_order_status" &&
      typeof output.display_id === "number" &&
      (output.status === "ACCOUNT_NOT_LINKED" || output.status === "NOT_FOUND")
    ) {
      context.customer_order_lookup = {
        display_id: output.display_id,
        status: output.status
      }
    }

    if (
      result.name === "check_delivery_status" &&
      typeof output.display_id === "number" &&
      output.status === "FOUND" &&
      asRecord(output.order) &&
      asRecord(output.fulfillment)
    ) {
      context.customer_order_lookup = {
        display_id: output.display_id,
        fulfillment: output.fulfillment as FulfillmentReadOutput,
        order: output.order as OrderReadOutput,
        status: "FOUND",
      }
    }

    if (
      result.name === "check_delivery_status" &&
      typeof output.display_id === "number" &&
      (output.status === "ACCOUNT_NOT_LINKED" || output.status === "NOT_FOUND")
    ) {
      context.customer_order_lookup = {
        display_id: output.display_id,
        status: output.status,
      }
    }

    if (
      result.name === "check_order_status" &&
      typeof output.display_id === "number" &&
      output.status === "FOUND" &&
      asRecord(output.order)
    ) {
      context.customer_order_lookup = {
        display_id: output.display_id,
        order: output.order as OrderReadOutput,
        status: "FOUND"
      }
    }
  }

  // Tool selection, not keyword matching, controls the response path in ACTIVE
  // mode. Catalog takes priority so the existing hybrid response composer can
  // combine it with approved knowledge when both tools were intentionally used.
  if (context.catalog_snapshot) {
    context.route = "PRODUCT_DISCOVERY"
  } else if (context.knowledge_snapshot) {
    context.route = "STORE_QUESTION"
  }

  return context
}
