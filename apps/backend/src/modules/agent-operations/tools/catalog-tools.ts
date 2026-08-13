import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

export const CatalogReadInput = z.strictObject({
  limit: z.number().int().min(1).max(12).default(6),
  locale: z.enum(["en", "vi"]).default("vi"),
  query: z.string().trim().min(1).max(160).optional(),
})

export const CatalogProductVariant = z.strictObject({
  availability: z.enum([
    "IN_STOCK",
    "NOT_MANAGED",
    "OUT_OF_STOCK",
    "UNKNOWN",
  ]),
  available_quantity: z.number().nullable(),
  currency_code: z.string().nullable(),
  id: z.string().min(1),
  manage_inventory: z.boolean(),
  price: z.number().nullable(),
  sku: z.string().nullable(),
  title: z.string().min(1),
})

export const CatalogProductResult = z.strictObject({
  category_names: z.array(z.string()),
  collection_title: z.string().nullable(),
  description: z.string().nullable(),
  handle: z.string().min(1),
  id: z.string().min(1),
  subtitle: z.string().nullable(),
  thumbnail: z.string().nullable(),
  title: z.string().min(1),
  product_url: z.url().nullable(),
  variants: z.array(CatalogProductVariant),
})

export const CatalogReadOutput = z.strictObject({
  products: z.array(CatalogProductResult),
  query: z.string().nullable(),
  status: z.literal("READY"),
  total_count: z.number().int().nonnegative(),
})

export type CatalogReadInput = z.infer<typeof CatalogReadInput>
export type CatalogReadOutput = z.infer<typeof CatalogReadOutput>
export type CatalogProductResult = z.infer<typeof CatalogProductResult>

export const CATALOG_READ_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "query",
    "locale",
    "total_count",
    "product_ids",
    "availability",
  ],
  description:
    "Search the live published Medusa catalog and read total variant availability.",
  error_codes: ["CATALOG_READ_FAILED", "INVALID_TOOL_INPUT"],
  idempotency: "NOT_REQUIRED",
  input_schema: CatalogReadInput,
  kind: "READ",
  name: "catalog.read",
  output_schema: CatalogReadOutput,
  permission: "agent_catalog:read",
  required_role: null,
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 250,
    max_attempts: 2,
    max_delay_ms: 1_000,
  },
  risk_level: "READ_ONLY",
  timeout_ms: 5_000,
  version: "1.0.0",
})
