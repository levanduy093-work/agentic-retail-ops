import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  getTotalVariantAvailability,
  ProductStatus,
} from "@medusajs/framework/utils"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  CATALOG_REALTIME_STOCK_TOOL,
  CatalogRealtimeStockInput,
  CatalogRealtimeStockOutput,
} from "./tools/catalog-tools"

type QueryVariant = {
  id: string
  manage_inventory?: boolean | null
  product?: { id?: string; status?: string | null } | null
  title?: string | null
}

function variantMatchesSelection(
  variant: QueryVariant,
  input: Extract<CatalogRealtimeStockInput, { product_id: string }>
) {
  const title = variant.title?.toLocaleLowerCase() ?? ""
  return [input.color, input.size]
    .filter((value): value is string => Boolean(value))
    .every((value) => title.includes(value.toLocaleLowerCase()))
}

export async function executeCatalogRealtimeStockCheck(
  container: MedusaContainer,
  input: CatalogRealtimeStockInput
) {
  return executeAgentTool<
    CatalogRealtimeStockInput,
    CatalogRealtimeStockOutput
  >(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: "customer-product-advisor",
        granted_permissions: [CATALOG_REALTIME_STOCK_TOOL.permission],
        mode: "DIRECT",
      },
      input,
      tool_name: CATALOG_REALTIME_STOCK_TOOL.name,
      tool_version: CATALOG_REALTIME_STOCK_TOOL.version,
    },
    async (parsed) => {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const requestedQuantity = parsed.quantity
      const variantResult = await query.graph({
        entity: "product_variant",
        fields: ["id", "manage_inventory", "product.id", "product.status", "title"],
        filters:
          "variant_id" in parsed
            ? { id: parsed.variant_id }
            : { product_id: parsed.product_id },
        pagination: { skip: 0, take: "variant_id" in parsed ? 2 : 100 },
      })
      const queriedVariants = variantResult.data as QueryVariant[]
      const matchingVariants = queriedVariants.filter((variant) =>
        "variant_id" in parsed ? true : variantMatchesSelection(variant, parsed)
      )
      const publishedVariants = matchingVariants.filter(
        (variant) => variant.product?.id && variant.product.status === ProductStatus.PUBLISHED
      )
      if (!publishedVariants.length) {
        return {
          product_id: "product_id" in parsed ? parsed.product_id : null,
          requested_quantity: requestedQuantity,
          status: "NOT_FOUND" as const,
          variants: [],
        }
      }
      const availability = await getTotalVariantAvailability(query, {
        variant_ids: publishedVariants.map((variant) => variant.id),
      })
      return {
        product_id:
          "product_id" in parsed
            ? parsed.product_id
            : publishedVariants[0].product?.id ?? null,
        requested_quantity: requestedQuantity,
        status: "FOUND" as const,
        variants: publishedVariants.map((variant) => {
          const managed = variant.manage_inventory !== false
          const availableQuantity = managed
            ? Number(availability[variant.id]?.availability)
            : null
          const validQuantity =
            availableQuantity !== null && Number.isFinite(availableQuantity)
              ? availableQuantity
              : null
          const stockStatus = !managed
            ? ("NOT_MANAGED" as const)
            : validQuantity === null
              ? ("UNKNOWN" as const)
              : validQuantity >= requestedQuantity
                ? ("IN_STOCK" as const)
                : ("OUT_OF_STOCK" as const)
          return {
            availability: stockStatus,
            available_quantity: validQuantity,
            can_fulfill_requested_quantity:
              !managed || (validQuantity !== null && validQuantity >= requestedQuantity),
            id: variant.id,
            title: variant.title?.trim() || "Default",
          }
        }),
      }
    }
  )
}
