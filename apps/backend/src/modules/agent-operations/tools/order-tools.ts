import type { OrderDetailDTO } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

export const OrderReadInput = z.strictObject({
  order_id: z.string().trim().min(1),
})

export const OrderReadOutput = z.strictObject({
  canceled_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  currency_code: z.string().min(1),
  customer_id: z.string().min(1).nullable(),
  display_id: z.number().int(),
  fulfillment_count: z.number().int().nonnegative(),
  fulfillment_status: z.string().min(1),
  item_count: z.number().int().nonnegative(),
  order_id: z.string().min(1),
  order_status: z.string().min(1),
  payment_collection_count: z.number().int().nonnegative(),
  payment_status: z.string().min(1),
  total: z.number(),
  updated_at: z.string().datetime(),
  version: z.number().int().nonnegative(),
})

export type OrderReadInput = z.infer<typeof OrderReadInput>
export type OrderReadOutput = z.infer<typeof OrderReadOutput>

export const ORDER_READ_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "order_id",
    "order_status",
    "payment_status",
    "fulfillment_status",
    "version",
  ],
  description:
    "Read a live Medusa order snapshot with aggregated payment and fulfillment status.",
  error_codes: ["INVALID_TOOL_INPUT", "ORDER_NOT_FOUND", "ORDER_READ_FAILED"],
  idempotency: "NOT_REQUIRED",
  input_schema: OrderReadInput,
  kind: "READ",
  name: "order.read",
  output_schema: OrderReadOutput,
  permission: "agent_order:read",
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

function toIso(value: Date | string) {
  return new Date(value).toISOString()
}

export function toOrderReadOutput(order: OrderDetailDTO): OrderReadOutput {
  return OrderReadOutput.parse({
    canceled_at: order.canceled_at ? toIso(order.canceled_at) : null,
    created_at: toIso(order.created_at),
    currency_code: order.currency_code,
    customer_id: order.customer_id ?? null,
    display_id: order.display_id,
    fulfillment_count: order.fulfillments?.length ?? 0,
    fulfillment_status: order.fulfillment_status,
    item_count: order.items?.reduce(
      (total, item) => total + Number(item.quantity),
      0
    ) ?? 0,
    order_id: order.id,
    order_status: order.status,
    payment_collection_count: order.payment_collections?.length ?? 0,
    payment_status: order.payment_status,
    total: Number(order.total),
    updated_at: toIso(order.updated_at),
    version: order.version,
  })
}

export const OrderSearchItemSchema = z.strictObject({
  id: z.string(),
  product_title: z.string(),
  quantity: z.number().int().positive(),
  thumbnail: z.string().nullable(),
  unit_price: z.number(),
  variant_title: z.string().nullable(),
})

export const OrderSearchSummarySchema = z.strictObject({
  canceled_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  currency_code: z.string(),
  customer_id: z.string().nullable(),
  display_id: z.number().int(),
  email: z.string().nullable(),
  fulfillment_status: z.string(),
  items: z.array(OrderSearchItemSchema),
  order_id: z.string(),
  order_status: z.string(),
  payment_status: z.string(),
  shipping_address: z
    .strictObject({
      address_1: z.string().nullable(),
      city: z.string().nullable(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
      phone: z.string().nullable(),
      province: z.string().nullable(),
    })
    .nullable(),
  total: z.number(),
})

export const OrderSearchInput = z.strictObject({
  customer_id: z.string().trim().min(1).optional(),
  display_id: z.number().int().positive().optional(),
  email: z.string().trim().min(3).optional(),
  limit: z.number().int().min(1).max(10).default(5),
  phone: z.string().trim().min(6).max(20).optional(),
  query: z.string().trim().min(1).max(100).optional(),
})

export const OrderSearchOutput = z.strictObject({
  orders: z.array(OrderSearchSummarySchema),
  total_count: z.number().int().nonnegative(),
})

export type OrderSearchInput = z.infer<typeof OrderSearchInput>
export type OrderSearchOutput = z.infer<typeof OrderSearchOutput>
export type OrderSearchSummary = z.infer<typeof OrderSearchSummarySchema>

export const ORDER_SEARCH_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: ["phone", "email", "display_id", "customer_id", "query"],
  description:
    "Search and locate customer orders by phone number, email address, customer name, display ID, or product keywords.",
  error_codes: ["INVALID_TOOL_INPUT", "ORDER_SEARCH_FAILED"],
  idempotency: "NOT_REQUIRED",
  input_schema: OrderSearchInput,
  kind: "READ",
  name: "order.search",
  output_schema: OrderSearchOutput,
  permission: "agent_order:read",
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
