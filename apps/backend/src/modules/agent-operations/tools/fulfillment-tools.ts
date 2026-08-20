import type { OrderDetailDTO } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

export const FulfillmentReadInput = z.strictObject({
  order_id: z.string().trim().min(1),
})

const FulfillmentTracking = z.strictObject({
  carrier: z.string().min(1).nullable(),
  current_status: z.string().min(1).nullable(),
  delivered_at: z.string().datetime().nullable(),
  fulfillment_id: z.string().min(1),
  shipped_at: z.string().datetime().nullable(),
  tracking_number: z.string().min(1).nullable(),
  tracking_url: z.string().url().nullable(),
})

export const FulfillmentReadOutput = z.strictObject({
  display_id: z.number().int(),
  fulfillment_status: z.string().min(1),
  fulfillments: z.array(FulfillmentTracking),
  order_id: z.string().min(1),
  version: z.number().int().nonnegative(),
})

export type FulfillmentReadInput = z.infer<typeof FulfillmentReadInput>
export type FulfillmentReadOutput = z.infer<typeof FulfillmentReadOutput>

export const FULFILLMENT_READ_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "order_id",
    "display_id",
    "fulfillment_status",
    "fulfillments.fulfillment_id",
    "fulfillments.current_status",
  ],
  description:
    "Read live fulfillment and carrier tracking facts for an order. Never estimates delivery time.",
  error_codes: [
    "INVALID_TOOL_INPUT",
    "ORDER_NOT_FOUND",
    "FULFILLMENT_READ_FAILED",
  ],
  idempotency: "NOT_REQUIRED",
  input_schema: FulfillmentReadInput,
  kind: "READ",
  name: "fulfillment.read",
  output_schema: FulfillmentReadOutput,
  permission: "agent_fulfillment:read",
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

type OrderFulfillment = {
  data?: Record<string, unknown> | null
  delivered_at?: Date | string | null
  id: string
  labels?: Array<{
    tracking_number?: string | null
    tracking_url?: string | null
  }> | null
  provider_id?: string | null
  shipped_at?: Date | string | null
}

function toOptionalIso(value: unknown) {
  if (!(typeof value === "string" || value instanceof Date)) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function toSafeTrackingUrl(value: unknown) {
  const candidate = toOptionalString(value)
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

export function toFulfillmentReadOutput(
  order: OrderDetailDTO
): FulfillmentReadOutput {
  const fulfillments = (order.fulfillments ?? []) as OrderFulfillment[]

  return FulfillmentReadOutput.parse({
    display_id: order.display_id,
    fulfillment_status: order.fulfillment_status,
    fulfillments: fulfillments.map((fulfillment) => {
      const data = fulfillment.data ?? {}
      const label = fulfillment.labels?.[0]

      return {
        carrier: toOptionalString(fulfillment.provider_id),
        current_status:
          toOptionalString(data.ghn_current_status) ??
          (fulfillment.delivered_at
            ? "delivered"
            : fulfillment.shipped_at
              ? "shipping"
              : "created"),
        delivered_at: toOptionalIso(fulfillment.delivered_at),
        fulfillment_id: fulfillment.id,
        shipped_at: toOptionalIso(fulfillment.shipped_at),
        tracking_number:
          toOptionalString(data.tracking_number) ??
          toOptionalString(data.ghn_order_code) ??
          toOptionalString(label?.tracking_number),
        tracking_url:
          toSafeTrackingUrl(data.tracking_url) ??
          toSafeTrackingUrl(data.ghn_tracking_url) ??
          toSafeTrackingUrl(label?.tracking_url),
      }
    }),
    order_id: order.id,
    version: order.version,
  })
}
