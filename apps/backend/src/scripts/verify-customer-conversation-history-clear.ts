import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { clearCustomerConversationHistoryWorkflow } from "../workflows/agent-operations/clear-customer-conversation-history"

export default async function verifyCustomerConversationHistoryClear({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const runId = `verify-clear-history-${Date.now()}`
  const now = new Date()
  const conversation = await service.createAgentConversations({
    channel: "IN_APP",
    last_message_at: now,
    metadata: { customer_id: `qa-customer:${runId}`, simulator: true },
    opened_at: now,
    status: "OPEN",
    tenant_id: "default",
    title: `QA clear history ${runId}`,
    topic_id: runId,
    topic_type: "CUSTOMER_SUPPORT_CHAT",
  })
  const message = await service.createAgentMessages({
    body: "Dữ liệu hội thoại kiểm thử phải được xóa.",
    channel: "IN_APP",
    conversation_id: conversation.id,
    direction: "INBOUND",
    idempotency_key: `${runId}:message`,
    message_type: "TEXT",
    occurred_at: now,
    processed_at: now,
    sender_id: `qa-customer:${runId}`,
    sender_type: "customer",
    status: "PROCESSED",
  })
  await service.createAgentConversationMemories({
    conversation_id: conversation.id,
    customer_facts: { items: ["Khách kiểm thử mặc size M."] },
    last_message_id: message.id,
    open_questions: { items: [] },
    resolved_topics: { items: [] },
    source_message_count: 1,
    summarized_at: now,
    summary: "Memory kiểm thử cần xóa.",
    tenant_id: "default",
    version: 1,
  })
  await service.createAgentCustomerPreferences({
    customer_id: `qa-customer:${runId}`,
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
    last_confirmed_at: now,
    preference_type: "SIZE",
    source_conversation_id: conversation.id,
    source_message_id: message.id,
    status: "CONFIRMED",
    tenant_id: "default",
    value: "M",
  })

  const { result } = await clearCustomerConversationHistoryWorkflow(
    container
  ).run({
    input: {
      actor_id: "qa-admin",
      conversation_id: conversation.id,
      idempotency_key: runId,
    },
  })

  assert.equal(result.cleared_message_count, 1)
  assert.equal(result.cleared_memory, true)
  assert.equal(result.cleared_preference_count, 1)
  assert.equal(
    (await service.listAgentMessages({ conversation_id: conversation.id })).length,
    0
  )
  assert.equal(
    (
      await service.listAgentConversationMemories({
        conversation_id: conversation.id,
      })
    ).length,
    0
  )
  assert.equal(
    (await service.listAgentConversations({ id: conversation.id })).length,
    0
  )
  assert.equal(
    (
      await service.listAgentCustomerPreferences({
        source_conversation_id: conversation.id,
      })
    ).length,
    0
  )

  console.log(
    JSON.stringify({
      cleared_memory: result.cleared_memory,
      cleared_message_count: result.cleared_message_count,
      cleared_preference_count: result.cleared_preference_count,
      passed: true,
    })
  )
}
