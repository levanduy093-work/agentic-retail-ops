import {
  calculateOutboxRetry,
  isOutboxEventClaimable,
  sanitizeOutboxError,
} from "../outbox-policy"

describe("agent outbox policy", () => {
  const now = new Date("2026-08-10T00:00:00.000Z")

  test("claims due pending events and expired leases only", () => {
    expect(
      isOutboxEventClaimable(
        { available_at: now, status: "PENDING" },
        now
      )
    ).toBe(true)
    expect(
      isOutboxEventClaimable(
        {
          available_at: now,
          lock_expires_at: "2026-08-09T23:59:59.000Z",
          status: "PROCESSING",
        },
        now
      )
    ).toBe(true)
    expect(
      isOutboxEventClaimable(
        {
          available_at: now,
          lock_expires_at: "2026-08-10T00:01:00.000Z",
          status: "PROCESSING",
        },
        now
      )
    ).toBe(false)
    expect(
      isOutboxEventClaimable(
        { available_at: now, status: "DELIVERED" },
        now
      )
    ).toBe(false)
  })

  test("uses bounded exponential retry delays", () => {
    const retry = calculateOutboxRetry(3, now, {
      max_attempts: 5,
      max_retry_delay_ms: 15_000,
      retry_base_delay_ms: 5_000,
    })

    expect(retry.status).toBe("FAILED")
    expect(retry.available_at.toISOString()).toBe("2026-08-10T00:00:15.000Z")
  })

  test("moves exhausted events to dead letter", () => {
    const retry = calculateOutboxRetry(5, now, {
      max_attempts: 5,
      max_retry_delay_ms: 60_000,
      retry_base_delay_ms: 5_000,
    })

    expect(retry).toEqual({ available_at: now, status: "DEAD" })
  })

  test("sanitizes stored delivery errors", () => {
    expect(sanitizeOutboxError(new Error("line one\nline two\tvalue"))).toBe(
      "line one line two value"
    )
    expect(sanitizeOutboxError("string error\nwith detail")).toBe(
      "string error with detail"
    )
  })
})
