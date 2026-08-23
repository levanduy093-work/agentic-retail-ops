import { createChannelAdapter } from "../channel-gateway"
import {
  decryptConnectorSecret,
  encryptConnectorSecret,
} from "../credential-vault"
import {
  resolveTikTokPrincipal,
  verifyTikTokWebhookSignature,
  TikTokChannelConfig,
  TikTokStoredCredentialPayload,
} from "../tiktok"

describe("tiktok channel foundation", () => {
  it("delivers text through TikTok Open API and returns its receipt", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: {
          msg_id: "tt_msg_1234567890",
        },
        message: "success",
      }),
      ok: true,
      status: 200,
    })
    const adapter = createChannelAdapter("TIKTOK", {
      tiktok: {
        access_token: "test-tiktok-access-token",
        api_base_url: "https://open.tiktokapis.com",
        fetch: fetcher as typeof fetch,
      },
    })

    const result = await adapter.deliver({
      body: "Xin chào! Shop có thể hỗ trợ gì cho bạn trên TikTok?",
      idempotency_key: "delivery-tt-1",
      message_id: "agmsg_tt_1",
      recipient_ref: "conversation_tt_999",
    })

    expect(result).toEqual({
      external_message_id: "tt_msg_1234567890",
      status: "DELIVERED",
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://open.tiktokapis.com/v2/im/message/send/",
      expect.objectContaining({
        body: JSON.stringify({
          content: JSON.stringify({
            text: "Xin chào! Shop có thể hỗ trợ gì cho bạn trên TikTok?",
          }),
          conversation_id: "conversation_tt_999",
          msg_type: "text",
        }),
        headers: {
          Authorization: "Bearer test-tiktok-access-token",
          "access-token": "test-tiktok-access-token",
          "content-type": "application/json",
        },
        method: "POST",
      })
    )
  })

  it("fails closed when TikTok API rejects a message delivery", async () => {
    const adapter = createChannelAdapter("TIKTOK", {
      tiktok: {
        access_token: "invalid-token",
        fetch: jest.fn().mockResolvedValue({
          json: async () => ({
            code: 40001,
            message: "Invalid Access Token or Expired",
          }),
          ok: false,
          status: 401,
        }) as typeof fetch,
      },
    })

    await expect(
      adapter.deliver({
        body: "Test message",
        idempotency_key: "delivery-tt-2",
        message_id: "agmsg_tt_2",
        recipient_ref: "invalid_conv",
      })
    ).rejects.toThrow(
      "TikTok delivery failed: Invalid Access Token or Expired"
    )
  })

  it("resolves TikTok customer principal for mapped and unmapped users", () => {
    const config: TikTokChannelConfig = {
      account_id: "tt_shop_12345",
      allow_unmapped_users: true,
      identities: [
        { tiktok_user_id: "tt_user_buyer_01", user_id: "customer_vip_01" },
      ],
    }

    expect(
      resolveTikTokPrincipal(config, "tt_user_buyer_01")
    ).toEqual({
      external_user_id: "tt_user_buyer_01",
      principal_id: "customer_vip_01",
      role: "CUSTOMER",
    })

    expect(
      resolveTikTokPrincipal(config, "tt_user_unknown_99")
    ).toEqual({
      external_user_id: "tt_user_unknown_99",
      principal_id: "tiktok:tt_user_unknown_99",
      role: "CUSTOMER",
    })

    const restrictedConfig: TikTokChannelConfig = {
      ...config,
      allow_unmapped_users: false,
    }
    expect(
      resolveTikTokPrincipal(restrictedConfig, "tt_user_unknown_99")
    ).toBeNull()
  })

  it("verifies TikTok Webhook HMAC-SHA256 signatures accurately", () => {
    const clientSecret = "tiktok_client_secret_xyz123"
    const bodyString = JSON.stringify({
      data: {
        content: "Khách hỏi tư vấn trên TikTok",
        conversation_id: "conv_123",
      },
      event: "im.receive_msg",
    })

    const crypto = require("node:crypto")
    const computedHash = crypto
      .createHmac("sha256", clientSecret)
      .update(bodyString, "utf8")
      .digest("hex")

    expect(
      verifyTikTokWebhookSignature({
        bodyString,
        clientSecret,
        expectedSignature: `sha256=${computedHash}`,
      })
    ).toBe(true)

    expect(
      verifyTikTokWebhookSignature({
        bodyString,
        clientSecret,
        expectedSignature: computedHash,
      })
    ).toBe(true)

    expect(
      verifyTikTokWebhookSignature({
        bodyString,
        clientSecret,
        expectedSignature: "sha256=invalid_hash_signature_000",
      })
    ).toBe(false)
  })

  it("encrypts and decrypts TikTok credential payloads securely", () => {
    const payload: TikTokStoredCredentialPayload = {
      access_token: "act.tiktok_access_token_value_123",
      account_avatar: "https://p16-sign-va.tiktokcdn.com/avatar.jpg",
      account_id: "tt_shop_12345",
      account_name: "Synapse Official TikTok",
      client_key: "tt_app_client_key_999",
      client_secret: "tt_app_secret_888",
      refresh_token: "rft.tiktok_refresh_token_value_456",
      webhook_secret: "tt_webhook_secret_777",
    }

    const encrypted = encryptConnectorSecret(JSON.stringify(payload))
    const decrypted = decryptConnectorSecret(encrypted)
    const parsed = JSON.parse(decrypted) as TikTokStoredCredentialPayload

    expect(parsed.access_token).toBe("act.tiktok_access_token_value_123")
    expect(parsed.account_id).toBe("tt_shop_12345")
    expect(parsed.account_name).toBe("Synapse Official TikTok")
    expect(parsed.client_key).toBe("tt_app_client_key_999")
    expect(parsed.client_secret).toBe("tt_app_secret_888")
    expect(parsed.webhook_secret).toBe("tt_webhook_secret_777")
  })
})
