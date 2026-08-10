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
