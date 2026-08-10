import {
  OrderExceptionEventInput,
  OrderExceptionRecommendation,
} from "./types"
import { OrderReadOutput } from "./tools/order-tools"

const RESOLVED_ORDER_STATUSES = new Set(["archived", "canceled", "completed"])
const RESOLVED_PAYMENT_STATUSES = new Set([
  "captured",
  "completed",
  "partially_refunded",
  "refunded",
])
const RESOLVED_FULFILLMENT_STATUSES = new Set([
  "delivered",
  "shipped",
])

function taskDueAt(detectedAt: string, minutes: number) {
  return new Date(new Date(detectedAt).getTime() + minutes * 60_000).toISOString()
}

function resolvedReason(
  input: OrderExceptionEventInput,
  order: OrderReadOutput
) {
  if (RESOLVED_ORDER_STATUSES.has(order.order_status)) {
    return `Order is already ${order.order_status}.`
  }

  if (
    input.payload.exception_type === "PAYMENT_STUCK" &&
    RESOLVED_PAYMENT_STATUSES.has(order.payment_status)
  ) {
    return `Payment is already ${order.payment_status}.`
  }

  if (
    input.payload.exception_type === "FULFILLMENT_OVERDUE" &&
    RESOLVED_FULFILLMENT_STATUSES.has(order.fulfillment_status)
  ) {
    return `Fulfillment is already ${order.fulfillment_status}.`
  }

  return null
}

export function analyzeOrderException(
  input: OrderExceptionEventInput,
  order: OrderReadOutput
): OrderExceptionRecommendation {
  const resolved = resolvedReason(input, order)
  const evidence = {
    detected_at: input.payload.detected_at,
    exception_type: input.payload.exception_type,
    live_order: order,
    signal_details: input.payload.details ?? {},
    sla_due_at: input.payload.sla_due_at ?? null,
  }

  if (resolved) {
    return {
      action_type: "NO_ACTION",
      evidence,
      proposal: {},
      rationale: `${resolved} The incoming signal is stale or no longer actionable.`,
      risk_level: "READ_ONLY",
      summary: `Order #${order.display_id} no longer needs exception handling.`,
      terminal_status: "RESOLVED",
    }
  }

  const task = {
    FULFILLMENT_OVERDUE: {
      due_minutes: 60,
      priority: "HIGH" as const,
      task_type: "ORDER_FULFILLMENT_REVIEW",
      title: `Review overdue fulfillment for order #${order.display_id}`,
    },
    MANUAL_REVIEW: {
      due_minutes: 240,
      priority: "MEDIUM" as const,
      task_type: "ORDER_MANUAL_REVIEW",
      title: `Review order exception for order #${order.display_id}`,
    },
    PAYMENT_STUCK: {
      due_minutes: 30,
      priority: "HIGH" as const,
      task_type: "ORDER_PAYMENT_REVIEW",
      title: `Review stuck payment for order #${order.display_id}`,
    },
  }[input.payload.exception_type]

  return {
    action_type: "CREATE_TASK",
    evidence,
    proposal: {
      description:
        "Inspect the live order and coordinate the next safe operational step. Do not cancel, refund, capture payment, or mutate fulfillment from this task.",
      due_at: taskDueAt(input.payload.detected_at, task.due_minutes),
      input: {
        exception_type: input.payload.exception_type,
        order_id: order.order_id,
        order_version: order.version,
      },
      priority: task.priority,
      task_type: task.task_type,
      tenant_id: input.tenant_id,
      title: task.title,
    },
    rationale:
      "The exception is still present in the live Medusa order. Human operational review is required before any commerce mutation.",
    risk_level: task.priority === "HIGH" ? "HIGH" : "MEDIUM",
    summary: `${input.payload.exception_type} remains active for order #${order.display_id}.`,
  }
}
