import { AgentActionRequestStatus } from "./types"

type ActionLeaseRecord = {
  available_at: Date | string
  lock_expires_at?: Date | string | null
  status: AgentActionRequestStatus
}

type ActionRetryPolicy = {
  max_attempts: number
  max_retry_delay_ms: number
  retry_base_delay_ms: number
}

export function isAgentActionClaimable(
  action: ActionLeaseRecord,
  now: Date
) {
  const availableAt = new Date(action.available_at).getTime()

  if (
    (action.status === "PENDING" || action.status === "FAILED") &&
    availableAt <= now.getTime()
  ) {
    return true
  }

  return (
    action.status === "PROCESSING" &&
    !!action.lock_expires_at &&
    new Date(action.lock_expires_at).getTime() <= now.getTime()
  )
}

export function calculateActionRetry(
  attemptCount: number,
  failedAt: Date,
  policy: ActionRetryPolicy
) {
  if (attemptCount >= policy.max_attempts) {
    return {
      available_at: failedAt,
      status: "DEAD" as const,
    }
  }

  const delay = Math.min(
    policy.retry_base_delay_ms * 2 ** Math.max(attemptCount - 1, 0),
    policy.max_retry_delay_ms
  )

  return {
    available_at: new Date(failedAt.getTime() + delay),
    status: "FAILED" as const,
  }
}
