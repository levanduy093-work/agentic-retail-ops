import assert from "node:assert/strict"
import { createServer } from "node:http"
import { AddressInfo } from "node:net"
import { createUsersWorkflow, deleteUsersWorkflow } from "@medusajs/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { configureTelegramChannelWorkflow } from "../workflows/agent-operations/configure-telegram-channel"
import { dispatchAgentDeliveryWorkflow } from "../workflows/agent-operations/dispatch-agent-delivery"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { requestAgentActionWorkflow } from "../workflows/agent-operations/request-agent-action"

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<
    string,
    unknown
  >
}

export default async function verifyTelegramAdapter({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const baseUrl = process.env.AGENT_HTTP_BASE_URL ?? "http://localhost:9000"
  const verificationId = `telegram-verifier-${Date.now()}`
  const requests: Array<{ body: Record<string, unknown>; method: string }> = []
  const mockServer = createServer(async (request, response) => {
    const method = request.url?.split("/").pop() ?? "unknown"
    const body = await readBody(request)
    requests.push({ body, method })
    const result =
      method === "getMe"
        ? { first_name: "Agent Test Bot", id: 123456, username: "agent_test_bot" }
        : method === "sendMessage"
          ? { message_id: 9001 }
          : true
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ ok: true, result }))
  })
  await new Promise<void>((resolve) =>
    mockServer.listen(0, "127.0.0.1", resolve)
  )
  const mockAddress = mockServer.address() as AddressInfo
  const previousToken = process.env.TELEGRAM_BOT_TOKEN
  const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  process.env.TELEGRAM_BOT_TOKEN = "123456:test-token"
  process.env.TELEGRAM_WEBHOOK_SECRET = "telegram_test_secret"

  const { result: users } = await createUsersWorkflow(container).run({
    input: {
      users: [
        {
          email: `${verificationId}@local.invalid`,
          first_name: "Telegram",
          last_name: "Verifier",
          metadata: { purpose: "telegram-adapter-verification" },
        },
      ],
    },
  })
  const user = users[0]
  let connectionId: string | undefined

  try {
    const configured = await configureTelegramChannelWorkflow(container).run({
      input: {
        account_ref: verificationId,
        api_base_url: `http://127.0.0.1:${mockAddress.port}`,
        identities: [{ chat_id: "424242", user_id: user.id }],
        public_base_url: "https://telegram-verifier.invalid",
      },
    })
    connectionId = configured.result.connection.id
    assert.equal(configured.result.connection.status, "ACTIVE")

    const webhookUrl = `${baseUrl}/webhooks/agent-operations/telegram/${connectionId}`
    const update = {
      message: {
        chat: { id: 424242, type: "private" },
        date: Math.floor(Date.now() / 1_000),
        from: {
          first_name: "Telegram",
          id: 424242,
          is_bot: false,
          username: "telegram_verifier",
        },
        message_id: 7001,
        text: "Kiểm tra kết nối hệ thống",
      },
      update_id: Date.now(),
    }
    const postWebhook = (body: Record<string, unknown>, secret: string) =>
      fetch(webhookUrl, {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": secret,
        },
        method: "POST",
      })

    const invalidSecret = await postWebhook(update, "wrong_secret")
    assert.equal(invalidSecret.status, 401)
    const inbound = await postWebhook(update, "telegram_test_secret")
    assert.equal(inbound.status, 200)
    const inboundBody = (await inbound.json()) as {
      conversation_id: string
      duplicate: boolean
      message_id: string
    }
    assert.equal(inboundBody.duplicate, false)
    const duplicate = await postWebhook(update, "telegram_test_secret")
    assert.equal(duplicate.status, 200)
    assert.equal(
      ((await duplicate.json()) as { duplicate: boolean }).duplicate,
      true
    )
    const unauthorized = await postWebhook(
      {
        ...update,
        message: {
          ...update.message,
          chat: { id: 999999, type: "private" },
          message_id: 7002,
        },
        update_id: update.update_id + 1,
      },
      "telegram_test_secret"
    )
    assert.equal(unauthorized.status, 200)
    assert.equal(
      ((await unauthorized.json()) as { ignored: boolean }).ignored,
      true
    )

    const requested = await requestAgentActionWorkflow(container).run({
      input: {
        correlation_id: `${verificationId}:outbound`,
        granted_permissions: ["agent_message:create"],
        idempotency_key: `${verificationId}:message-send`,
        input: {
          body: "Kết nối Telegram đã hoạt động.",
          conversation_id: inboundBody.conversation_id,
          message_type: "TEXT",
        },
        requested_by_id: user.id,
        requested_by_type: "user",
        tenant_id: "default",
        tool_name: "message.send",
        tool_version: "1.0.0",
      },
    })
    const executed = await executeAgentActionWorkflow(container).run({
      input: {
        action_request_id: requested.result.action.id,
        actor_id: "telegram-verifier-worker",
        actor_type: "worker",
        worker_id: "telegram-verifier-worker",
      },
    })
    assert.equal(executed.result.action.status, "SUCCEEDED")
    const actionResult = executed.result.action.result as Record<string, unknown>
    assert.equal(typeof actionResult.delivery_id, "string")

    const dispatched = await dispatchAgentDeliveryWorkflow(container).run({
      input: {
        delivery_id: String(actionResult.delivery_id),
        worker_id: "telegram-delivery-verifier",
      },
    })
    assert.equal(dispatched.result.delivered, true)
    assert.equal(dispatched.result.status, "DELIVERED")
    const repeatedDispatch = await dispatchAgentDeliveryWorkflow(container).run(
      {
        input: {
          delivery_id: String(actionResult.delivery_id),
          worker_id: "telegram-delivery-verifier-repeat",
        },
      }
    )
    assert.equal(repeatedDispatch.result.skipped, true)

    const messages = await service.listAgentMessages(
      { conversation_id: inboundBody.conversation_id },
      { order: { occurred_at: "ASC" } }
    )
    assert.equal(messages.length, 2)
    assert.equal(messages[0].direction, "INBOUND")
    assert.equal(messages[1].direction, "OUTBOUND")
    assert.equal(messages[1].external_message_id, "9001")
    assert.equal(
      requests.filter((request) => request.method === "sendMessage").length,
      1
    )
    const setWebhook = requests.find(
      (request) => request.method === "setWebhook"
    )
    assert.equal(setWebhook?.body.secret_token, "telegram_test_secret")
    assert.equal(setWebhook?.body.allowed_updates instanceof Array, true)

    console.log(
      JSON.stringify(
        {
          connection_id: connectionId,
          duplicate_update_suppressed: true,
          invalid_secret_blocked: true,
          outbound_delivery: "DELIVERED",
          repeated_delivery_skipped: true,
          status: "TELEGRAM_ADAPTER_VERIFIED_WITH_MOCK_API",
          unauthorized_chat_ignored: true,
        },
        null,
        2
      )
    )
  } finally {
    if (connectionId) {
      await service.updateAgentChannelConnections({
        id: connectionId,
        status: "DISABLED",
      })
    }
    await deleteUsersWorkflow(container).run({ input: { ids: [user.id] } })
    await new Promise<void>((resolve, reject) =>
      mockServer.close((error) => (error ? reject(error) : resolve()))
    )
    if (previousToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN
    } else {
      process.env.TELEGRAM_BOT_TOKEN = previousToken
    }
    if (previousSecret === undefined) {
      delete process.env.TELEGRAM_WEBHOOK_SECRET
    } else {
      process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret
    }
  }
}
