import { createChannelAdapter } from "../channel-gateway"
import {
  decryptConnectorSecret,
  encryptConnectorSecret,
} from "../credential-vault"
import {
  resolveFacebookPrincipal,
  verifyFacebookWebhookSignature,
  FacebookMessengerChannelConfig,
  FacebookStoredCredentialPayload,
} from "../facebook"

describe("facebook messenger channel foundation", () => {
  it("delivers text through Facebook Graph API and returns its receipt", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      json: async () => ({
        message_id: "m_mid_1234567890",
        recipient_id: "psid_987654321",
      }),
      ok: true,
      status: 200,
    })
    const adapter = createChannelAdapter("MESSENGER", {
      messenger: {
        api_base_url: "https://graph.facebook.com/v19.0",
        fetch: fetcher as typeof fetch,
        page_access_token: "test-page-access-token",
      },
    })

    const result = await adapter.deliver({
      body: "Xin chào! Cửa hàng có thể hỗ trợ gì cho bạn?",
      idempotency_key: "delivery-fb-1",
      message_id: "agmsg_fb_1",
      recipient_ref: "psid_987654321",
    })

    expect(result).toEqual({
      external_message_id: "m_mid_1234567890",
      status: "DELIVERED",
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://graph.facebook.com/v19.0/me/messages?access_token=test-page-access-token",
      expect.objectContaining({
        body: JSON.stringify({
          message: { text: "Xin chào! Cửa hàng có thể hỗ trợ gì cho bạn?" },
          messaging_type: "RESPONSE",
          recipient: { id: "psid_987654321" },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    )
  })

  it("signals advisory typing through Facebook Messenger", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    const adapter = createChannelAdapter("MESSENGER", {
      messenger: {
        api_base_url: "https://graph.facebook.com/v19.0",
        fetch: fetcher as typeof fetch,
        page_access_token: "test-page-access-token",
      },
    })

    await expect(adapter.signalTyping?.("psid_987654321")).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith(
      "https://graph.facebook.com/v19.0/me/messages?access_token=test-page-access-token",
      expect.objectContaining({
        body: JSON.stringify({
          recipient: { id: "psid_987654321" },
          sender_action: "typing_on",
        }),
        method: "POST",
      })
    )
  })

  it("fails closed when Facebook Messenger rejects a message delivery", async () => {
    const adapter = createChannelAdapter("MESSENGER", {
      messenger: {
        fetch: jest.fn().mockResolvedValue({
          json: async () => ({
            error: {
              code: 10,
              message: "Permission Denied / Token Expired",
              type: "OAuthException",
            },
          }),
          ok: false,
          status: 400,
        }) as typeof fetch,
        page_access_token: "invalid-token",
      },
    })

    await expect(
      adapter.deliver({
        body: "Test message",
        idempotency_key: "delivery-fb-2",
        message_id: "agmsg_fb_2",
        recipient_ref: "psid_invalid",
      })
    ).rejects.toThrow("Facebook Messenger delivery failed: Permission Denied / Token Expired")
  })

  it("resolves Facebook customer principal for mapped and unmapped users", () => {
    const config: FacebookMessengerChannelConfig = {
      allow_unmapped_users: true,
      identities: [
        { psid: "psid_vip_123", user_id: "customer_vip_01" },
      ],
      page_id: "100200300400",
    }

    expect(resolveFacebookPrincipal(config, "psid_vip_123")).toEqual({
      external_user_id: "psid_vip_123",
      principal_id: "customer_vip_01",
      role: "CUSTOMER",
    })

    expect(resolveFacebookPrincipal(config, "psid_unknown_999")).toEqual({
      external_user_id: "psid_unknown_999",
      principal_id: "messenger:psid_unknown_999",
      role: "CUSTOMER",
    })

    const restrictedConfig: FacebookMessengerChannelConfig = {
      ...config,
      allow_unmapped_users: false,
    }
    expect(resolveFacebookPrincipal(restrictedConfig, "psid_unknown_999")).toBeNull()
  })

  it("verifies Facebook Webhook HMAC-SHA256 signatures accurately", () => {
    const appSecret = "meta_app_secret_123456"
    const bodyString = JSON.stringify({
      entry: [
        {
          id: "100200300400",
          messaging: [
            {
              message: { mid: "m_123", text: "Xin chào shop" },
              recipient: { id: "100200300400" },
              sender: { id: "psid_12345" },
            },
          ],
        },
      ],
      object: "page",
    })

    const crypto = require("node:crypto")
    const computedHash = crypto
      .createHmac("sha256", appSecret)
      .update(bodyString, "utf8")
      .digest("hex")

    expect(
      verifyFacebookWebhookSignature({
        appSecret,
        bodyString,
        expectedSignature: `sha256=${computedHash}`,
      })
    ).toBe(true)

    expect(
      verifyFacebookWebhookSignature({
        appSecret,
        bodyString,
        expectedSignature: computedHash,
      })
    ).toBe(true)

    expect(
      verifyFacebookWebhookSignature({
        appSecret,
        bodyString,
        expectedSignature: "sha256=invalid_hash_signature_000",
      })
    ).toBe(false)
  })

  it("encrypts and decrypts Facebook credential payloads securely", () => {
    const payload: FacebookStoredCredentialPayload = {
      app_id: "fb_app_999",
      app_secret: "fb_secret_888",
      page_access_token: "EAAX...token_value",
      page_avatar: "https://lookaside.fbsbx.com/picture.jpg",
      page_id: "100200300400",
      page_name: "Synapse Fashion Official",
      verify_token: "synapse_meta_verify_token_123",
    }

    const encrypted = encryptConnectorSecret(JSON.stringify(payload))
    const decrypted = decryptConnectorSecret(encrypted)
    const parsed = JSON.parse(decrypted) as FacebookStoredCredentialPayload

    expect(parsed.page_access_token).toBe("EAAX...token_value")
    expect(parsed.page_id).toBe("100200300400")
    expect(parsed.page_name).toBe("Synapse Fashion Official")
    expect(parsed.verify_token).toBe("synapse_meta_verify_token_123")
  })
})
