import { DeliveryStatus } from "./types"

export type DeliveryLeaseSnapshot = {
  attempt_count: number
  available_at: Date | string
  lock_expires_at?: Date | string | null
  status: DeliveryStatus
}

export function isAgentDeliveryClaimable(
  delivery: DeliveryLeaseSnapshot,
  now: Date
) {
  if (["PENDING", "FAILED"].includes(delivery.status)) {
    return new Date(delivery.available_at) <= now
  }

  return (
    delivery.status === "PROCESSING" &&
    Boolean(delivery.lock_expires_at) &&
    new Date(delivery.lock_expires_at!) <= now
  )
}

export function calculateDeliveryRetry(
  attemptCount: number,
  failedAt: Date,
  options: {
    max_attempts: number
    max_retry_delay_ms: number
    retry_base_delay_ms: number
  }
) {
  if (attemptCount >= options.max_attempts) {
    return { available_at: failedAt, status: "DEAD" as const }
  }

  const delay = Math.min(
    options.retry_base_delay_ms * 2 ** Math.max(0, attemptCount - 1),
    options.max_retry_delay_ms
  )

  return {
    available_at: new Date(failedAt.getTime() + delay),
    status: "FAILED" as const,
  }
}
