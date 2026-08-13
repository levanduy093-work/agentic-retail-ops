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

  it("sends advisory text promptly and then verified product photos", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 43 } }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({ ok: true, result: [] }),
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

    await adapter.deliver({
      body: "Sốp chọn hai mẫu phù hợp.",
      idempotency_key: "delivery-media",
      message_id: "agmsg_media",
      recipient_ref: "123456",
      structured_content: {
        product_media: [
          {
            image_url: "https://cdn.example/one.jpg",
            product_id: "prod_1",
            title: "Mẫu một",
          },
          {
            image_url: "https://cdn.example/two.jpg",
            product_id: "prod_2",
            title: "Mẫu hai",
          },
        ],
      },
    })

    expect(fetcher.mock.calls[0][0]).toContain("/sendMessage")
    expect(fetcher.mock.calls[1][0]).toContain("/sendMediaGroup")
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({
      chat_id: "123456",
      media: [
        { media: "https://cdn.example/one.jpg", type: "photo" },
        { media: "https://cdn.example/two.jpg", type: "photo" },
      ],
    })
  })

  it("rejects private media URLs and still sends the advisory text", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: { message_id: 44 } }),
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

    await adapter.deliver({
      body: "Nội dung tư vấn",
      idempotency_key: "delivery-private-media",
      message_id: "agmsg_private_media",
      recipient_ref: "123456",
      structured_content: {
        product_media: [
          {
            image_url: "http://localhost:9000/admin-secret.jpg",
            product_id: "prod_1",
            title: "Không an toàn",
          },
        ],
      },
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toContain("/sendMessage")
  })

  it("falls back to text when Telegram cannot fetch product media", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 45 } }),
        ok: true,
        status: 200,
      })
      .mockRejectedValueOnce(new Error("media timeout"))
    const adapter = createChannelAdapter("TELEGRAM", {
      telegram: {
        api_base_url: "https://telegram.test",
        bot_token: "test-token",
        fetch: fetcher as typeof fetch,
      },
    })

    await expect(
      adapter.deliver({
        body: "Nội dung vẫn được gửi",
        idempotency_key: "delivery-media-fallback",
        message_id: "agmsg_media_fallback",
        recipient_ref: "123456",
        structured_content: {
          product_media: [
            {
              image_url: "https://cdn.example/product.jpg",
              product_id: "prod_1",
              title: "Mẫu phù hợp",
            },
          ],
        },
      })
    ).resolves.toEqual({ external_message_id: "45", status: "DELIVERED" })
    expect(fetcher.mock.calls[0][0]).toContain("/sendMessage")
    expect(fetcher.mock.calls[1][0]).toContain("/sendPhoto")
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
