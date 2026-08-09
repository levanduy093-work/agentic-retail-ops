import assert from "node:assert/strict"
import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { dispatchAgentOutboxEventWorkflow } from "../workflows/agent-operations/dispatch-agent-outbox-event"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { processConversationMessageWorkflow } from "../workflows/agent-operations/process-conversation-message"

async function waitForApprovalConversation(
  agentOperations: AgentOperationsModuleService,
  approvalId: string
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const conversations = await agentOperations.listAgentConversations({
      channel: "IN_APP",
      topic_id: approvalId,
      topic_type: "APPROVAL",
    })

    if (conversations[0]) {
      return conversations[0]
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return null
}

export default async function verifyAgentFoundation({ container }: ExecArgs) {
  const agentOperations = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const verificationId = `verify-agent-foundation-${Date.now()}`
  const input = {
    correlation_id: verificationId,
    event_id: verificationId,
    event_type: "inventory.low" as const,
    event_version: 1,
    occurred_at: new Date().toISOString(),
    payload: {
      alternative_locations: [
        {
          available_quantity: 18,
          location_id: "warehouse-hn",
        },
        {
          available_quantity: 9,
          location_id: "warehouse-dn",
        },
      ],
      available_quantity: 2,
      inventory_item_id: "inventory-verification-item",
      location_id: "warehouse-hcm",
      required_quantity: 12,
      sku: "VERIFY-AGENT-FOUNDATION",
    },
    source: "agent-foundation-verifier",
    subject_id: "inventory-verification-item",
    subject_type: "inventory_item" as const,
    tenant_id: "default",
  }

  const first = await agentOperations.processInventoryLowEvent(input)
  assert.equal(first.duplicate, false)
  assert.ok(first.recommendation)
  assert.equal(first.incident.status, "AWAITING_APPROVAL")
  assert.equal(first.recommendation.action_type, "INVENTORY_TRANSFER")
  assert.equal(first.recommendation.risk_level, "HIGH")
  assert.equal(first.approval?.status, "PENDING")

  const duplicate = await agentOperations.processInventoryLowEvent(input)
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.incident?.id, first.incident.id)
  assert.equal(duplicate.recommendation?.id, first.recommendation.id)
  assert.equal(duplicate.approval?.id, first.approval?.id)

  assert.ok(first.approval)
  const approvalRequestedOutboxEvents =
    await agentOperations.listAgentOutboxEvents({
      aggregate_id: first.incident.id,
      event_type: "agent.approval.requested",
    })
  assert.equal(approvalRequestedOutboxEvents.length, 1)
  const { result: notificationDispatch } =
    await dispatchAgentOutboxEventWorkflow(container).run({
      input: {
        event_id: approvalRequestedOutboxEvents[0].id,
        worker_id: "verification-notification-worker",
      },
    })
  assert.equal(notificationDispatch.delivered, true)

  const conversation = await waitForApprovalConversation(
    agentOperations,
    first.approval.id
  )
  assert.ok(conversation)
  const notificationMessages = await agentOperations.listAgentMessages({
    conversation_id: conversation.id,
  })
  assert.equal(notificationMessages.length, 1)
  assert.equal(notificationMessages[0].direction, "OUTBOUND")
  assert.equal(notificationMessages[0].message_type, "NOTIFICATION")
  assert.equal(notificationMessages[0].status, "AVAILABLE")

  const decisionInput = {
    actor_id: "verification-operations-manager",
    approval_id: first.approval.id,
    decision: "APPROVED" as const,
    reason: "Runtime verification of the approval and outbox boundary",
  }
  const clientMessageId = `${verificationId}:approval-command`
  const { result: conversationCommand } =
    await processConversationMessageWorkflow(container).run({
      input: {
        actor_id: decisionInput.actor_id,
        body: "Duyệt đề xuất chuyển kho để kiểm chứng chat command",
        client_message_id: clientMessageId,
        command: {
          approval_id: decisionInput.approval_id,
          decision: decisionInput.decision,
          name: "APPROVAL_DECISION",
          reason: decisionInput.reason,
        },
        conversation_id: conversation.id,
      },
    })
  assert.equal(conversationCommand.accepted, true)
  assert.equal(conversationCommand.duplicate, false)
  assert.equal(conversationCommand.inbound_message.status, "PROCESSED")
  assert.equal(conversationCommand.response_message.status, "AVAILABLE")

  const { result: duplicateConversationCommand } =
    await processConversationMessageWorkflow(container).run({
      input: {
        actor_id: decisionInput.actor_id,
        body: "Duyệt đề xuất chuyển kho để kiểm chứng chat command",
        client_message_id: clientMessageId,
        command: {
          approval_id: decisionInput.approval_id,
          decision: decisionInput.decision,
          name: "APPROVAL_DECISION",
          reason: decisionInput.reason,
        },
        conversation_id: conversation.id,
      },
    })
  assert.equal(duplicateConversationCommand.accepted, true)
  assert.equal(duplicateConversationCommand.duplicate, true)
  assert.equal(
    duplicateConversationCommand.inbound_message.id,
    conversationCommand.inbound_message.id
  )

  const chatMessages = await agentOperations.listAgentMessages(
    { conversation_id: conversation.id },
    { order: { occurred_at: "ASC" } }
  )
  assert.equal(chatMessages.length, 3)
  assert.deepEqual(
    chatMessages.map((message) => message.message_type),
    ["NOTIFICATION", "COMMAND", "COMMAND_RESULT"]
  )

  const actionRequestsAfterCommand =
    await agentOperations.listAgentActionRequests({
      approval_id: first.approval.id,
    })
  assert.equal(actionRequestsAfterCommand.length, 1)
  assert.equal(actionRequestsAfterCommand[0].status, "PENDING")

  const decision = await agentOperations.decideApproval(decisionInput)
  assert.equal(decision.duplicate, true)
  assert.equal(decision.approval.status, "APPROVED")
  assert.equal(decision.action_request?.id, actionRequestsAfterCommand[0].id)

  const duplicateDecision = await agentOperations.decideApproval(decisionInput)
  assert.equal(duplicateDecision.duplicate, true)
  assert.equal(
    duplicateDecision.action_request?.id,
    decision.action_request?.id
  )

  const executingIncident = await agentOperations.retrieveAgentIncident(
    first.incident.id
  )
  assert.equal(executingIncident.status, "EXECUTING")

  assert.ok(decision.action_request)
  const { result: actionResult } = await executeAgentActionWorkflow(
    container
  ).run({
    input: {
      action_request_id: decision.action_request.id,
      actor_id: "verification-action-worker",
      actor_type: "worker",
      worker_id: "verification-action-worker",
    },
  })
  assert.equal(actionResult.skipped, false)
  assert.equal(actionResult.action.status, "CONFLICT")

  const incident = await agentOperations.retrieveAgentIncident(
    first.incident.id
  )
  assert.equal(incident.status, "OPTIONS_READY")

  const actionRequests = await agentOperations.listAgentActionRequests({
    incident_id: incident.id,
  })
  assert.equal(actionRequests.length, 1)
  assert.equal(actionRequests[0].status, "CONFLICT")

  const toolCalls = await agentOperations.listAgentToolCalls(
    { incident_id: incident.id },
    { order: { started_at: "ASC" } }
  )
  assert.equal(toolCalls.length, 2)
  assert.equal(
    toolCalls.find((toolCall) => toolCall.kind === "READ")?.status,
    "SUCCEEDED"
  )
  assert.equal(
    toolCalls.find((toolCall) => toolCall.kind === "COMMAND")?.status,
    "CONFLICT"
  )

  const auditEvents = await agentOperations.listAgentAuditEvents({
    incident_id: incident.id,
  })
  assert.equal(auditEvents.length, 5)

  const outboxEvents = await agentOperations.listAgentOutboxEvents({
    aggregate_id: incident.id,
  })
  assert.equal(outboxEvents.length, 4)
  assert.equal(
    outboxEvents.filter((event) => event.status === "DELIVERED").length,
    1
  )
  assert.equal(
    outboxEvents.filter((event) => event.status === "PENDING").length,
    3
  )

  for (const outboxEvent of outboxEvents.filter(
    (event) => event.status !== "DELIVERED"
  )) {
    const { result } = await dispatchAgentOutboxEventWorkflow(container).run({
      input: {
        event_id: outboxEvent.id,
        worker_id: "verification-outbox-worker",
      },
    })

    assert.equal(result.delivered, true)
    assert.equal(result.status, "DELIVERED")
  }

  const deliveredOutboxEvents = await agentOperations.listAgentOutboxEvents({
    aggregate_id: incident.id,
  })
  assert.deepEqual(
    deliveredOutboxEvents.map((event) => event.status),
    ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED"]
  )
  assert.deepEqual(
    deliveredOutboxEvents.map((event) => event.attempt_count),
    [1, 1, 1, 1]
  )

  const staleLeaseTime = new Date(Date.now() - 60_000)
  const recoveryEvent = await agentOperations.createAgentOutboxEvents({
    aggregate_id: `outbox-recovery:${verificationId}`,
    aggregate_type: "verification",
    attempt_count: 1,
    available_at: staleLeaseTime,
    event_type: "agent.verification.recovery",
    event_version: 1,
    idempotency_key: `outbox-recovery:${verificationId}`,
    lock_expires_at: staleLeaseTime,
    locked_at: staleLeaseTime,
    locked_by: "expired-verification-worker",
    payload: { verification_id: verificationId },
    status: "PROCESSING",
  })
  const recoveredClaim = await agentOperations.claimAgentOutboxEvent({
    claimed_at: new Date().toISOString(),
    event_id: recoveryEvent.id,
    lease_duration_ms: 60_000,
    worker_id: "recovery-verification-worker",
  })
  assert.equal(recoveredClaim.claimed, true)
  assert.equal(recoveredClaim.event?.attempt_count, 2)

  const competingClaim = await agentOperations.claimAgentOutboxEvent({
    claimed_at: new Date().toISOString(),
    event_id: recoveryEvent.id,
    lease_duration_ms: 60_000,
    worker_id: "competing-verification-worker",
  })
  assert.equal(competingClaim.claimed, false)

  const deadEvent = await agentOperations.markAgentOutboxEventFailed({
    error: "Forced verification failure\nwith sanitized detail",
    event_id: recoveryEvent.id,
    failed_at: new Date().toISOString(),
    max_attempts: 2,
    max_retry_delay_ms: 60_000,
    retry_base_delay_ms: 5_000,
    worker_id: "recovery-verification-worker",
  })
  assert.equal(deadEvent.status, "DEAD")
  assert.equal(
    deadEvent.last_error,
    "Forced verification failure with sanitized detail"
  )

  console.log(
    JSON.stringify(
      {
        approval_id: first.approval.id,
        action_request_id: decision.action_request.id,
        action_safe_conflict_verified:
          actionRequests[0].status === "CONFLICT",
        audit_event_count: auditEvents.length,
        chat_command_duplicate_suppressed:
          duplicateConversationCommand.duplicate,
        chat_message_count: chatMessages.length,
        communication_notification_verified:
          notificationMessages[0].status === "AVAILABLE",
        duplicate_approval_decision: duplicateDecision.duplicate,
        duplicate_event: duplicate.duplicate,
        incident_id: incident.id,
        incident_status: incident.status,
        outbox_dead_letter_verified: deadEvent.status === "DEAD",
        outbox_delivered_count: deliveredOutboxEvents.length,
        outbox_event_count: outboxEvents.length,
        outbox_lease_contention_verified: competingClaim.claimed === false,
        recommendation_id: first.recommendation.id,
        tool_call_count: toolCalls.length,
        verification_id: verificationId,
      },
      null,
      2
    )
  )
}
