import {
  calculateActionRetry,
  isAgentActionClaimable,
} from "../action-policy"

describe("agent action execution policy", () => {
  const now = new Date("2026-08-10T00:00:00.000Z")

  test("claims due actions and recovers expired processing leases", () => {
    expect(
      isAgentActionClaimable(
        { available_at: now, status: "PENDING" },
        now
      )
    ).toBe(true)
    expect(
      isAgentActionClaimable(
        {
          available_at: now,
          lock_expires_at: "2026-08-09T23:59:59.000Z",
          status: "PROCESSING",
        },
        now
      )
    ).toBe(true)
    expect(
      isAgentActionClaimable(
        {
          available_at: now,
          lock_expires_at: "2026-08-10T00:01:00.000Z",
          status: "PROCESSING",
        },
        now
      )
    ).toBe(false)
  })

  test("does not claim completed or conflicted actions", () => {
    expect(
      isAgentActionClaimable(
        { available_at: now, status: "SUCCEEDED" },
        now
      )
    ).toBe(false)
    expect(
      isAgentActionClaimable(
        { available_at: now, status: "CONFLICT" },
        now
      )
    ).toBe(false)
  })

  test("uses bounded retry and dead-letters exhausted actions", () => {
    expect(
      calculateActionRetry(3, now, {
        max_attempts: 5,
        max_retry_delay_ms: 15_000,
        retry_base_delay_ms: 5_000,
      })
    ).toEqual({
      available_at: new Date("2026-08-10T00:00:15.000Z"),
      status: "FAILED",
    })
    expect(
      calculateActionRetry(5, now, {
        max_attempts: 5,
        max_retry_delay_ms: 15_000,
        retry_base_delay_ms: 5_000,
      })
    ).toEqual({ available_at: now, status: "DEAD" })
  })
})
