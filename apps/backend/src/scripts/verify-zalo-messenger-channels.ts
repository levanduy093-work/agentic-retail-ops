import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import {
  verifyZaloWebhookSignature,
  type ZaloChannelConfig,
} from "../modules/agent-operations/zalo"
import {
  verifyFacebookWebhookSignature,
  type FacebookMessengerChannelConfig,
} from "../modules/agent-operations/facebook"

export default async function verifyZaloMessengerChannels({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const verificationId = `omnichannel-verifier-${Date.now()}`
  console.log(`[OmnichannelVerify] Starting verification run: ${verificationId}`)

  // 1. Verify Zalo OA Adapter & Signature Verification
  console.log("[OmnichannelVerify] 1. Testing Zalo OA Adapter...")
  const zaloAppSecret = "zalo_test_app_secret_12345"
  const zaloOaId = "oa_88889999"
  const zaloPayload = JSON.stringify({
    app_id: "123456789",
    event_name: "user_send_text",
    message: {
      msg_id: "msg_zalo_001",
      text: "Xin chào shop Synapse",
    },
    oa_id: zaloOaId,
    sender: { id: "zalo_user_123" },
    timestamp: Date.now().toString(),
  })
  const zaloSignature = `mac=${createHmac("sha256", zaloAppSecret).update(zaloPayload).digest("hex")}`

  const isZaloValid = verifyZaloWebhookSignature({
    appId: "123456789",
    bodyString: zaloPayload,
    expectedSignature: zaloSignature,
    oaSecretKey: zaloAppSecret,
  })
  assert.equal(isZaloValid, true, "Valid Zalo signature must pass")

  const isZaloInvalid = verifyZaloWebhookSignature({
    appId: "123456789",
    bodyString: zaloPayload,
    expectedSignature: "mac=invalid_mac_123",
    oaSecretKey: zaloAppSecret,
  })
  assert.equal(isZaloInvalid, false, "Invalid Zalo signature must fail")

  const zaloConfig: ZaloChannelConfig = {
    app_id: "123456789",
    identities: [],
    oa_id: zaloOaId,
  }
  const zaloConnection = await service.createAgentChannelConnections({
    account_ref: `zalo-${verificationId}`,
    channel: "ZALO",
    config: zaloConfig as unknown as Record<string, unknown>,
    status: "ACTIVE",
    tenant_id: "default",
  })
  assert.ok(zaloConnection.id, "Zalo channel connection created")
  console.log("[OmnichannelVerify] Zalo OA Adapter passed.")

  // 2. Verify Facebook Messenger Adapter & Signature Verification
  console.log("[OmnichannelVerify] 2. Testing Facebook Messenger Adapter...")
  const fbAppSecret = "fb_messenger_secret_67890"
  const fbPageId = "page_55556666"
  const fbPayload = JSON.stringify({
    entry: [
      {
        id: fbPageId,
        messaging: [
          {
            message: {
              mid: "mid_fb_001",
              text: "Shop có áo khoác gió không?",
            },
            recipient: { id: fbPageId },
            sender: { id: "fb_user_456" },
            timestamp: Date.now(),
          },
        ],
        time: Date.now(),
      },
    ],
    object: "page",
  })
  const fbSignature = `sha256=${createHmac("sha256", fbAppSecret).update(fbPayload).digest("hex")}`

  const isFbValid = verifyFacebookWebhookSignature({
    appSecret: fbAppSecret,
    bodyString: fbPayload,
    expectedSignature: fbSignature,
  })
  assert.equal(isFbValid, true, "Valid Facebook signature must pass")

  const isFbInvalid = verifyFacebookWebhookSignature({
    appSecret: fbAppSecret,
    bodyString: fbPayload,
    expectedSignature: "sha256=invalid_hash_456",
  })
  assert.equal(isFbInvalid, false, "Invalid Facebook signature must fail")

  const fbConfig: FacebookMessengerChannelConfig = {
    identities: [],
    page_id: fbPageId,
    verify_token: "fb_verify_token_sample",
  }
  const fbConnection = await service.createAgentChannelConnections({
    account_ref: `facebook-${verificationId}`,
    channel: "MESSENGER",
    config: fbConfig as unknown as Record<string, unknown>,
    status: "ACTIVE",
    tenant_id: "default",
  })
  assert.ok(fbConnection.id, "Facebook channel connection created")
  console.log("[OmnichannelVerify] Facebook Messenger Adapter passed.")

  console.log("[OmnichannelVerify] All Omnichannel verifications SUCCEEDED!")
}
