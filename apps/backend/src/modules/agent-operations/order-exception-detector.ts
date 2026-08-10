import { OrderReadOutput } from "./tools/order-tools"
import { OrderExceptionType } from "./types"

export const ORDER_PAYMENT_DUE_AT_METADATA_KEY = "agent_payment_due_at"
export const ORDER_FULFILLMENT_DUE_AT_METADATA_KEY =
  "agent_fulfillment_due_at"

const TERMINAL_ORDER_STATUSES = new Set(["archived", "canceled", "completed"])
const SETTLED_PAYMENT_STATUSES = new Set([
  "captured",
  "completed",
  "partially_refunded",
  "refunded",
])
const COMPLETED_FULFILLMENT_STATUSES = new Set(["delivered", "shipped"])

export type DetectedOrderException = {
  due_at: string
  exception_type: Exclude<OrderExceptionType, "MANUAL_REVIEW">
  reason: string
}

function overdueIso(value: unknown, now: Date) {
  if (typeof value !== "string") {
    return null
  }

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || timestamp > now.getTime()) {
    return null
  }

  return new Date(timestamp).toISOString()
}

export function detectOrderSlaException(
  order: OrderReadOutput,
  metadata: Record<string, unknown> | null | undefined,
  now: Date
): DetectedOrderException | null {
  if (TERMINAL_ORDER_STATUSES.has(order.order_status)) {
    return null
  }

  const paymentDueAt = overdueIso(
    metadata?.[ORDER_PAYMENT_DUE_AT_METADATA_KEY],
    now
  )
  if (
    paymentDueAt &&
    !SETTLED_PAYMENT_STATUSES.has(order.payment_status)
  ) {
    return {
      due_at: paymentDueAt,
      exception_type: "PAYMENT_STUCK",
      reason: `Payment SLA passed while payment status is ${order.payment_status}.`,
    }
  }

  const fulfillmentDueAt = overdueIso(
    metadata?.[ORDER_FULFILLMENT_DUE_AT_METADATA_KEY],
    now
  )
  if (
    fulfillmentDueAt &&
    !COMPLETED_FULFILLMENT_STATUSES.has(order.fulfillment_status)
  ) {
    return {
      due_at: fulfillmentDueAt,
      exception_type: "FULFILLMENT_OVERDUE",
      reason: `Fulfillment SLA passed while fulfillment status is ${order.fulfillment_status}.`,
    }
  }

  return null
}

export function buildOrderSlaEventId(
  orderId: string,
  detected: DetectedOrderException
) {
  return [
    "order-sla",
    orderId,
    detected.exception_type.toLowerCase(),
    detected.due_at,
  ].join(":")
}
