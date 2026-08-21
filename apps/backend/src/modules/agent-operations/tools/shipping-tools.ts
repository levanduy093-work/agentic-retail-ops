import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

export const ShippingEstimateInput = z.strictObject({
  destination_location: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe(
      "Customer's destination province, city, or district in Vietnam (e.g., 'Sóc Trăng', 'Đà Nẵng', 'Hà Nội', 'Cần Thơ')."
    ),
  weight: z
    .number()
    .int()
    .positive()
    .max(50_000)
    .optional()
    .default(150)
    .describe("Estimated package weight in grams, default is 150g."),
})

export const ShippingEstimateOutput = z.strictObject({
  carrier: z.string().min(1),
  destination_district: z.string().nullable(),
  destination_province: z.string().min(1),
  estimated_fee: z.number().int().nonnegative(),
  estimated_fee_formatted: z.string().min(1),
  expected_delivery_date: z.string().nullable(),
  from_location: z.string().min(1),
  leadtime_days: z.number().int().positive(),
  leadtime_text: z.string().min(1),
  summary: z.string().min(1),
})

export type ShippingEstimateInput = z.infer<typeof ShippingEstimateInput>
export type ShippingEstimateOutput = z.infer<typeof ShippingEstimateOutput>

export const SHIPPING_ESTIMATE_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "destination_province",
    "destination_district",
    "leadtime_days",
    "estimated_fee",
    "carrier",
  ],
  description:
    "Estimate live shipping delivery lead time (number of days) and shipping fee to a destination province/city in Vietnam using Giao Hàng Nhanh (GHN). Use this whenever a customer asks how many days delivery takes to their location, shipping time, or shipping cost before placing an order.",
  error_codes: [
    "INVALID_DESTINATION",
    "SHIPPING_ESTIMATE_FAILED",
    "CARRIER_UNAVAILABLE",
  ],
  idempotency: "NOT_REQUIRED",
  input_schema: ShippingEstimateInput,
  kind: "READ",
  name: "shipping.estimate_delivery",
  output_schema: ShippingEstimateOutput,
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
