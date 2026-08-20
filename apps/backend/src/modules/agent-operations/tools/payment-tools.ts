import type { OrderDetailDTO } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

export const PaymentReadInput = z.strictObject({
  order_id: z.string().trim().min(1),
})

export const PaymentReadOutput = z.strictObject({
  currency_code: z.string().min(1),
  display_id: z.number().int(),
  order_id: z.string().min(1),
  payment_collection_count: z.number().int().nonnegative(),
  payment_status: z.string().min(1),
  total: z.number(),
  updated_at: z.string().datetime(),
  version: z.number().int().nonnegative(),
})

export type PaymentReadInput = z.infer<typeof PaymentReadInput>
export type PaymentReadOutput = z.infer<typeof PaymentReadOutput>

export const PAYMENT_READ_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "order_id",
    "display_id",
    "payment_status",
    "payment_collection_count",
    "version",
  ],
  description:
    "Read the live payment status and total for an order. Excludes payment credentials and payment-provider payloads.",
  error_codes: ["INVALID_TOOL_INPUT", "ORDER_NOT_FOUND", "PAYMENT_READ_FAILED"],
  idempotency: "NOT_REQUIRED",
  input_schema: PaymentReadInput,
  kind: "READ",
  name: "payment.read",
  output_schema: PaymentReadOutput,
  permission: "agent_payment:read",
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

export function toPaymentReadOutput(order: OrderDetailDTO): PaymentReadOutput {
  return PaymentReadOutput.parse({
    currency_code: order.currency_code,
    display_id: order.display_id,
    order_id: order.id,
    payment_collection_count: order.payment_collections?.length ?? 0,
    payment_status: order.payment_status,
    total: Number(order.total),
    updated_at: toIso(order.updated_at),
    version: order.version,
  })
}
