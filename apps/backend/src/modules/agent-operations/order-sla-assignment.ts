import {
  ORDER_FULFILLMENT_DUE_AT_METADATA_KEY,
  ORDER_PAYMENT_DUE_AT_METADATA_KEY,
} from "./order-exception-detector"
import { MedusaError } from "@medusajs/framework/utils"

export const ORDER_SLA_POLICY_VERSION = "order-sla-default@1.0.0"
export const ORDER_SLA_POLICY_VERSION_METADATA_KEY =
  "agent_sla_policy_version"
export const ORDER_SLA_SOURCE_METADATA_KEY = "agent_sla_source"

const DEFAULT_PAYMENT_SLA_MINUTES = 120
const DEFAULT_FULFILLMENT_SLA_MINUTES = 2_880
const MAX_SLA_MINUTES = 43_200

export type OrderSlaPolicy = {
  fulfillment_sla_minutes: number
  payment_sla_minutes: number
}

export type OrderSlaAssignmentInput = {
  created_at: Date | string
  is_draft_order?: boolean
  items?: Array<{ requires_shipping?: boolean | null }> | null
  metadata?: Record<string, unknown> | null
}

function boundedMinutes(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, MAX_SLA_MINUTES)
}

function validIso(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

export function resolveOrderSlaPolicy(
  environment: NodeJS.ProcessEnv = process.env
): OrderSlaPolicy {
  return {
    fulfillment_sla_minutes: boundedMinutes(
      environment.ORDER_FULFILLMENT_SLA_MINUTES,
      DEFAULT_FULFILLMENT_SLA_MINUTES
    ),
    payment_sla_minutes: boundedMinutes(
      environment.ORDER_PAYMENT_SLA_MINUTES,
      DEFAULT_PAYMENT_SLA_MINUTES
    ),
  }
}

export function assignOrderSlaMetadata(
  order: OrderSlaAssignmentInput,
  policy: OrderSlaPolicy = resolveOrderSlaPolicy()
) {
  const existing = order.metadata ?? {}

  if (order.is_draft_order) {
    return { changed: false, metadata: existing }
  }

  const createdAt = new Date(order.created_at)
  if (!Number.isFinite(createdAt.getTime())) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Order created_at must be a valid date"
    )
  }

  const paymentDueAt = validIso(existing[ORDER_PAYMENT_DUE_AT_METADATA_KEY])
    ? existing[ORDER_PAYMENT_DUE_AT_METADATA_KEY]
    : new Date(
        createdAt.getTime() + policy.payment_sla_minutes * 60_000
      ).toISOString()
  const requiresShipping =
    !order.items?.length ||
    order.items.some((item) => item.requires_shipping !== false)
  const fulfillmentDueAt = validIso(
    existing[ORDER_FULFILLMENT_DUE_AT_METADATA_KEY]
  )
    ? existing[ORDER_FULFILLMENT_DUE_AT_METADATA_KEY]
    : requiresShipping
      ? new Date(
          createdAt.getTime() + policy.fulfillment_sla_minutes * 60_000
        ).toISOString()
      : undefined
  const metadata: Record<string, unknown> = {
    ...existing,
    [ORDER_PAYMENT_DUE_AT_METADATA_KEY]: paymentDueAt,
    [ORDER_SLA_POLICY_VERSION_METADATA_KEY]:
      existing[ORDER_SLA_POLICY_VERSION_METADATA_KEY] ??
      ORDER_SLA_POLICY_VERSION,
    [ORDER_SLA_SOURCE_METADATA_KEY]:
      existing[ORDER_SLA_SOURCE_METADATA_KEY] ?? "medusa-order-created",
  }

  if (fulfillmentDueAt) {
    metadata[ORDER_FULFILLMENT_DUE_AT_METADATA_KEY] = fulfillmentDueAt
  }

  return {
    changed:
      metadata[ORDER_PAYMENT_DUE_AT_METADATA_KEY] !==
        existing[ORDER_PAYMENT_DUE_AT_METADATA_KEY] ||
      metadata[ORDER_FULFILLMENT_DUE_AT_METADATA_KEY] !==
        existing[ORDER_FULFILLMENT_DUE_AT_METADATA_KEY] ||
      metadata[ORDER_SLA_POLICY_VERSION_METADATA_KEY] !==
        existing[ORDER_SLA_POLICY_VERSION_METADATA_KEY] ||
      metadata[ORDER_SLA_SOURCE_METADATA_KEY] !==
        existing[ORDER_SLA_SOURCE_METADATA_KEY],
    metadata,
  }
}
