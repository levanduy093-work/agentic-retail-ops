import assert from "node:assert/strict"
import {
  createCustomersWorkflow,
  createOrderWorkflow,
} from "@medusajs/core-flows"
import type { ExecArgs, IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { TaskCommandOutput } from "../modules/agent-operations/tools/task-tools"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { createKnowledgeDocumentWorkflow } from "../workflows/agent-operations/create-knowledge-document"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { ingestSupportRequestWorkflow } from "../workflows/agent-operations/ingest-support-request"

export default async function verifyCustomerSupportAgent({
  container,
}: ExecArgs) {
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const verificationId = `verify-customer-support-${Date.now()}`
  const now = new Date()
  const [{ id: customerId }, { id: otherCustomerId }] = (
    await createCustomersWorkflow(container).run({
      input: {
        customersData: [
          {
            email: `${verificationId}@example.com`,
            first_name: "Support",
            last_name: "Verifier",
          },
          {
            email: `${verificationId}-other@example.com`,
            first_name: "Other",
            last_name: "Customer",
          },
        ],
      },
    })
  ).result
  const { result: order } = await createOrderWorkflow(container).run({
    input: {
      currency_code: "vnd",
      customer_id: customerId,
      items: [
        {
          is_discountable: false,
          is_tax_inclusive: true,
          quantity: 1,
          requires_shipping: false,
          title: "Customer support verification item",
          unit_price: 99.99,
        },
      ],
      metadata: {
        purpose: "customer-support-agent-runtime-verification",
      },
      no_notification: true,
      status: "pending",
    },
  })
  const { result: knowledgeCreation } =
    await createKnowledgeDocumentWorkflow(container).run({
      input: {
        citation_locator: `policy://customer-support/order-status/${verificationId}`,
        content:
          "Khi khách hỏi trạng thái đơn hàng, nhân viên cần kiểm tra trạng thái thanh toán và giao hàng trực tiếp trên hệ thống trước khi trả lời.",
        document_key: `customer-support-order-status-${verificationId}`,
        effective_at: new Date(now.getTime() - 60_000).toISOString(),
        locale: "vi",
        owner_id: "customer-support-runtime-verifier",
        scope: "customer_support",
        tenant_id: "default",
        title: "Hướng dẫn trả lời trạng thái đơn hàng",
        version: "1.0.0",
      },
    })
  const { result: knowledgeApproval } =
    await approveKnowledgeDocumentWorkflow(container).run({
      input: {
        actor_id: "customer-support-runtime-verifier",
        document_id: knowledgeCreation.document.id,
      },
    })

  assert.equal(knowledgeApproval.document.status, "APPROVED")
  const orderBefore = await orders.retrieveOrder(order.id)
  const occurredAt = new Date().toISOString()
  const input = {
    correlation_id: verificationId,
    event_id: verificationId,
    event_type: "support.requested" as const,
    event_version: 1,
    occurred_at: occurredAt,
    payload: {
      customer_id: customerId,
      locale: "vi" as const,
      order_id: order.id,
      question: "Cho tôi biết trạng thái đơn hàng, thanh toán và giao hàng.",
      request_type: "ORDER_STATUS" as const,
      requested_at: occurredAt,
    },
    source: "customer-support-runtime-verifier",
    subject_id: order.id,
    subject_type: "order" as const,
    tenant_id: "default",
  }
  const { result: first } = await ingestSupportRequestWorkflow(container).run({
    input,
  })

  assert.equal(first.duplicate, false)
  assert.equal(first.live_order.customer_id, customerId)
  assert.equal(first.draft.grounded, true)
  assert.equal(first.draft.requires_human_review, true)
  assert.ok(first.draft.citations.length >= 1)
  assert.ok(first.recommendation)
  assert.equal(first.recommendation.action_type, "REVIEW_SUPPORT_RESPONSE")
  assert.equal(first.recommendation.proposal.message_sent, false)
  assert.equal(first.action_request.tool_name, "task.create")
  assert.equal(first.action_request.status, "PENDING")

  const { result: duplicate } = await ingestSupportRequestWorkflow(
    container
  ).run({ input })
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.incident.id, first.incident.id)
  assert.equal(duplicate.action_request.id, first.action_request.id)

  const rejectedEventId = `${verificationId}-wrong-owner`
  let ownershipMismatchRejected = false
  try {
    await ingestSupportRequestWorkflow(container).run({
      input: {
        ...input,
        correlation_id: rejectedEventId,
        event_id: rejectedEventId,
        payload: {
          ...input.payload,
          customer_id: otherCustomerId,
        },
      },
    })
  } catch {
    ownershipMismatchRejected = true
  }
  assert.equal(ownershipMismatchRejected, true)

  const { result: execution } = await executeAgentActionWorkflow(container).run(
    {
      input: {
        action_request_id: first.action_request.id,
        actor_id: "customer-support-runtime-worker",
        actor_type: "worker",
        worker_id: "customer-support-runtime-worker",
      },
    }
  )
  const output = execution.action.result as unknown as TaskCommandOutput
  assert.equal(output.outcome, "SUCCEEDED")

  const events = await service.listAgentEvents({
    event_id: verificationId,
    source: input.source,
  })
  const rejectedEvents = await service.listAgentEvents({
    event_id: rejectedEventId,
    source: input.source,
  })
  const incidents = await service.listAgentIncidents({
    trigger_event_id: events[0].id,
  })
  const recommendations = await service.listAgentRecommendations({
    incident_id: first.incident.id,
  })
  const actionRequests = await service.listAgentActionRequests({
    incident_id: first.incident.id,
  })
  const tasks = await service.listAgentTasks({ incident_id: first.incident.id })
  const conversations = await service.listAgentConversations({
    incident_id: first.incident.id,
  })
  const messageSendActions = await service.listAgentActionRequests({
    incident_id: first.incident.id,
    tool_name: "message.send",
  })
  const toolCalls = await service.listAgentToolCalls({
    action_request_id: first.action_request.id,
  })
  const auditEvents = await service.listAgentAuditEvents({
    incident_id: first.incident.id,
  })
  const orderAfter = await orders.retrieveOrder(order.id)

  assert.equal(events.length, 1)
  assert.equal(rejectedEvents.length, 0)
  assert.equal(incidents.length, 1)
  assert.equal(recommendations.length, 1)
  assert.equal(actionRequests.length, 1)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].task_type, "SUPPORT_RESPONSE_REVIEW")
  assert.equal(conversations.length, 0)
  assert.equal(messageSendActions.length, 0)
  assert.equal(toolCalls.length, 1)
  assert.ok(auditEvents.length >= 3)
  assert.equal(orderAfter.status, orderBefore.status)
  assert.equal(orderAfter.version, orderBefore.version)
  assert.equal(orderAfter.canceled_at, orderBefore.canceled_at)

  console.log(
    JSON.stringify(
      {
        action_request_id: first.action_request.id,
        action_status: execution.action.status,
        approved_knowledge_id: knowledgeApproval.document.id,
        citations: first.draft.citations.length,
        customer_id: customerId,
        duplicate_suppressed: duplicate.duplicate,
        evidence: {
          action_requests: actionRequests.length,
          audit_events: auditEvents.length,
          conversations: conversations.length,
          events: events.length,
          incidents: incidents.length,
          message_send_actions: messageSendActions.length,
          recommendations: recommendations.length,
          tasks: tasks.length,
          tool_calls: toolCalls.length,
        },
        grounded: first.draft.grounded,
        incident_id: first.incident.id,
        order_id: order.id,
        order_unchanged: {
          canceled_at: orderAfter.canceled_at === orderBefore.canceled_at,
          status: orderAfter.status === orderBefore.status,
          version: orderAfter.version === orderBefore.version,
        },
        ownership_mismatch_rejected:
          ownershipMismatchRejected && rejectedEvents.length === 0,
        requires_human_review: first.draft.requires_human_review,
        status: "CUSTOMER_SUPPORT_AGENT_VERIFIED",
        task_id: tasks[0].id,
      },
      null,
      2
    )
  )
}
