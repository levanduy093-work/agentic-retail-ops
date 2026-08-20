import type { CustomerCatalogSnapshot } from "./customer-product-advisor"
import type { CustomerOrderLookup } from "./customer-order-lookup"
import type { NativeToolLoopResult } from "./native-tool-loop"
import type { KnowledgeSearchOutput } from "./tools/platform-read-tools"
import type { OrderReadOutput } from "./tools/order-tools"

export type NativeCustomerSupportContext = {
  catalog_snapshot?: CustomerCatalogSnapshot
  customer_order_lookup?: CustomerOrderLookup
  knowledge_snapshot?: KnowledgeSearchOutput
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

  return context
}
