import { createChannelAdapter } from "../channel-gateway"
import {
  calculateDeliveryRetry,
  isAgentDeliveryClaimable,
} from "../delivery-policy"
import { resolveSecretReference } from "../secret-reference"
import {
  findTelegramIdentity,
  resolveTelegramPrincipal,
  resolveTelegramUserId,
  secureTokenMatches,
} from "../telegram"

describe("telegram channel foundation", () => {
  it("delivers text through Telegram and returns its receipt", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: { message_id: 42 } }),
      ok: true,
      status: 200,
    })
    const adapter = createChannelAdapter("TELEGRAM", {
      telegram: {
        api_base_url: "https://telegram.test",
        bot_token: "test-token",
        fetch: fetcher as typeof fetch,
      },
    })

    await expect(
      adapter.deliver({
        body: "Xin chào",
        idempotency_key: "delivery-1",
        message_id: "agmsg_1",
        recipient_ref: "123456",
      })
    ).resolves.toEqual({ external_message_id: "42", status: "DELIVERED" })
    expect(fetcher).toHaveBeenCalledWith(
      "https://telegram.test/bottest-token/sendMessage",
      expect.objectContaining({
        body: JSON.stringify({ chat_id: "123456", text: "Xin chào" }),
        method: "POST",
      })
    )
  })

  it("fails closed when Telegram rejects a delivery", async () => {
    const adapter = createChannelAdapter("TELEGRAM", {
      telegram: {
        bot_token: "test-token",
        fetch: jest.fn().mockResolvedValue({
          json: async () => ({ description: "chat not found", ok: false }),
          ok: false,
          status: 400,
        }) as typeof fetch,
      },
    })

    await expect(
      adapter.deliver({
        body: "Test",
        idempotency_key: "delivery-2",
        message_id: "agmsg_2",
        recipient_ref: "missing",
      })
    ).rejects.toThrow("chat not found")
  })

  it("resolves environment secret references without storing the secret", () => {
    expect(
      resolveSecretReference("env:TELEGRAM_BOT_TOKEN", {
        TELEGRAM_BOT_TOKEN: "bot-secret",
      })
    ).toBe("bot-secret")
    expect(() => resolveSecretReference("plain-secret", {})).toThrow(
      "env:VARIABLE_NAME"
    )
  })

  it("uses constant-time webhook matching and explicit chat identities", () => {
    const config = {
      identities: [
        { chat_id: "123", user_id: "user_1" },
        { chat_id: "456", user_id: "customer_1" },
      ],
      webhook_secret_ref: "env:TELEGRAM_WEBHOOK_SECRET",
    }

    expect(secureTokenMatches("secret_1", "secret_1")).toBe(true)
    expect(secureTokenMatches("secret_2", "secret_1")).toBe(false)
    expect(findTelegramIdentity(config, "123")?.user_id).toBe("user_1")
    expect(findTelegramIdentity(config, "999")).toBeUndefined()
    expect(resolveTelegramUserId(config, "999")).toBeNull()
    expect(
      resolveTelegramUserId({ ...config, allow_unmapped_users: true }, "999")
    ).toBe("telegram:999")
    expect(resolveTelegramPrincipal(config, "123")).toMatchObject({
      principal_id: "user_1",
      role: "CUSTOMER",
    })
    expect(resolveTelegramPrincipal(config, "456")).toMatchObject({
      principal_id: "customer_1",
      role: "CUSTOMER",
    })
    expect(
      resolveTelegramPrincipal(
        { ...config, allow_unmapped_users: true },
        "999"
      )
    ).toMatchObject({ principal_id: "telegram:999", role: "CUSTOMER" })
  })

  it("treats every mapped Telegram identity as a customer", () => {
    const config = {
      identities: [{ chat_id: "123", user_id: "user_1" }],
      webhook_secret_ref: "env:TELEGRAM_WEBHOOK_SECRET",
    }

    expect(resolveTelegramPrincipal(config, "123")?.role).toBe("CUSTOMER")
  })

  it("retries failed delivery with backoff and eventually marks it dead", () => {
    const now = new Date("2026-08-11T00:00:00.000Z")
    expect(
      isAgentDeliveryClaimable(
        {
          attempt_count: 0,
          available_at: now,
          status: "PENDING",
        },
        now
      )
    ).toBe(true)
    expect(
      calculateDeliveryRetry(2, now, {
        max_attempts: 5,
        max_retry_delay_ms: 60_000,
        retry_base_delay_ms: 5_000,
      })
    ).toEqual({
      available_at: new Date("2026-08-11T00:00:10.000Z"),
      status: "FAILED",
    })
    expect(
      calculateDeliveryRetry(5, now, {
        max_attempts: 5,
        max_retry_delay_ms: 60_000,
        retry_base_delay_ms: 5_000,
      }).status
    ).toBe("DEAD")
  })
})
