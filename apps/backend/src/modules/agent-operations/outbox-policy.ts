import { OutboxStatus } from "./types"

export type OutboxClaimCandidate = {
  available_at: Date | string
  lock_expires_at?: Date | string | null
  status: OutboxStatus
}

export type OutboxRetryPolicy = {
  max_attempts: number
  max_retry_delay_ms: number
  retry_base_delay_ms: number
}

export function isOutboxEventClaimable(
  event: OutboxClaimCandidate,
  now: Date
) {
  if (event.status === "PENDING" || event.status === "FAILED") {
    return new Date(event.available_at).getTime() <= now.getTime()
  }

  if (event.status === "PROCESSING") {
    if (!event.lock_expires_at) {
      return true
    }

    return new Date(event.lock_expires_at).getTime() <= now.getTime()
  }

  return false
}

export function calculateOutboxRetry(
  attemptCount: number,
  failedAt: Date,
  policy: OutboxRetryPolicy
): { available_at: Date; status: "FAILED" | "DEAD" } {
  if (attemptCount >= policy.max_attempts) {
    return { available_at: failedAt, status: "DEAD" }
  }

  const exponent = Math.max(attemptCount - 1, 0)
  const retryDelay = Math.min(
    policy.retry_base_delay_ms * 2 ** exponent,
    policy.max_retry_delay_ms
  )

  return {
    available_at: new Date(failedAt.getTime() + retryDelay),
    status: "FAILED",
  }
}

export function sanitizeOutboxError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error"

  return message.replace(/[\r\n\t]+/g, " ").trim().slice(0, 1000)
}
