import { createChannelAdapter } from "../channel-gateway"
import {
  decryptConnectorSecret,
  encryptConnectorSecret,
} from "../credential-vault"
import {
  resolveZaloPrincipal,
  verifyZaloWebhookSignature,
  ZaloChannelConfig,
  ZaloStoredCredentialPayload,
} from "../zalo"

describe("zalo channel foundation", () => {
  it("delivers text through Zalo OpenAPI and returns its receipt", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      json: async () => ({
        data: { message_id: "zmsg_999" },
        error: 0,
        message: "Success",
      }),
      ok: true,
      status: 200,
    })
    const adapter = createChannelAdapter("ZALO", {
      zalo: {
        access_token: "test-zalo-token",
        api_base_url: "https://openapi.zalo.me",
        fetch: fetcher as typeof fetch,
      },
    })

    const result = await adapter.deliver({
      body: "Chào bạn, đơn hàng của bạn đang được xử lý!",
      idempotency_key: "delivery-zalo-1",
      message_id: "agmsg_zalo_1",
      recipient_ref: "zalo_user_12345",
    })

    expect(result).toEqual({
      external_message_id: "zmsg_999",
      status: "DELIVERED",
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      expect.objectContaining({
        body: JSON.stringify({
          message: { text: "Chào bạn, đơn hàng của bạn đang được xử lý!" },
          recipient: { user_id: "zalo_user_12345" },
        }),
        headers: {
          access_token: "test-zalo-token",
          "content-type": "application/json",
        },
        method: "POST",
      })
    )
  })

  it("fails closed when Zalo rejects a message delivery", async () => {
    const adapter = createChannelAdapter("ZALO", {
      zalo: {
        access_token: "test-zalo-token",
        fetch: jest.fn().mockResolvedValue({
          json: async () => ({ error: -216, message: "User not interacted in 7 days" }),
          ok: false,
          status: 400,
        }) as typeof fetch,
      },
    })

    await expect(
      adapter.deliver({
        body: "Test message",
        idempotency_key: "delivery-zalo-2",
        message_id: "agmsg_zalo_2",
        recipient_ref: "invalid_user",
      })
    ).rejects.toThrow("Zalo delivery failed")
  })

  it("resolves Zalo customer principal for mapped and unmapped users", () => {
    const config: ZaloChannelConfig = {
      allow_unmapped_users: true,
      identities: [
        { user_id: "customer_01", zalo_user_id: "zalo_12345" },
      ],
      oa_id: "123456789",
    }

    expect(resolveZaloPrincipal(config, "zalo_12345")).toEqual({
      external_user_id: "zalo_12345",
      principal_id: "customer_01",
      role: "CUSTOMER",
    })

    expect(resolveZaloPrincipal(config, "unknown_zalo_user")).toEqual({
      external_user_id: "unknown_zalo_user",
      principal_id: "zalo:unknown_zalo_user",
      role: "CUSTOMER",
    })

    const restrictedConfig: ZaloChannelConfig = {
      ...config,
      allow_unmapped_users: false,
    }
    expect(resolveZaloPrincipal(restrictedConfig, "unknown_zalo_user")).toBeNull()
  })

  it("verifies Zalo Webhook signatures accurately", () => {
    const appId = "app_12345"
    const oaSecretKey = "super_secret_key"
    const timestamp = 1720000000000
    const bodyString = JSON.stringify({
      event_name: "user_send_text",
      message: { text: "Hello" },
    })

    const crypto = require("crypto")
    const validSignature = crypto
      .createHash("sha256")
      .update(`${appId}${bodyString}${timestamp}${oaSecretKey}`)
      .digest("hex")

    expect(
      verifyZaloWebhookSignature({
        appId,
        bodyString,
        expectedSignature: validSignature,
        oaSecretKey,
        timestamp,
      })
    ).toBe(true)

    expect(
      verifyZaloWebhookSignature({
        appId,
        bodyString,
        expectedSignature: "invalid_sig_abc123",
        oaSecretKey,
        timestamp,
      })
    ).toBe(false)
  })

  it("encrypts and decrypts Zalo credential payloads with token expiration", () => {
    const payload: ZaloStoredCredentialPayload = {
      access_token: "zalo_access_token_123",
      app_id: "app_999",
      expires_at: Date.now() + 90000 * 1000,
      oa_id: "oa_777",
      oa_name: "Synapse Fashion Store",
      refresh_token: "zalo_refresh_token_456",
      secret_key: "secret_xyz",
    }

    const encrypted = encryptConnectorSecret(JSON.stringify(payload))
    const decrypted = decryptConnectorSecret(encrypted)
    const parsed = JSON.parse(decrypted)

    expect(parsed.access_token).toBe("zalo_access_token_123")
    expect(parsed.refresh_token).toBe("zalo_refresh_token_456")
    expect(parsed.oa_name).toBe("Synapse Fashion Store")
  })
})
