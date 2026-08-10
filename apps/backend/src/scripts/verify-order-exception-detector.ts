import assert from "node:assert/strict"
import { createOrderWorkflow } from "@medusajs/core-flows"
import type { ExecArgs, IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  buildOrderSlaEventId,
  detectOrderSlaException,
} from "../modules/agent-operations/order-exception-detector"
import { executeOrderRead } from "../modules/agent-operations/order-read-runtime"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { scanOrderExceptions } from "../jobs/detect-order-exceptions"

export default async function verifyOrderExceptionDetector({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const now = new Date()
  const dueAt = new Date(now.getTime() - 60_000).toISOString()
  const { result: order } = await createOrderWorkflow(container).run({
    input: {
      currency_code: "vnd",
      items: [
        {
          is_discountable: false,
          is_tax_inclusive: true,
          quantity: 1,
          requires_shipping: false,
          title: "Order SLA detector verification item",
          unit_price: 99.99,
        },
      ],
      metadata: {
        agent_payment_due_at: dueAt,
        purpose: "order-exception-detector-runtime-verification",
      },
      no_notification: true,
      status: "pending",
    },
  })
  const orderBefore = await orders.retrieveOrder(order.id)
  const read = await executeOrderRead(
    container,
    { order_id: order.id },
    "order-sla-detector-verifier"
  )
  const detected = detectOrderSlaException(
    read.output,
    order.metadata,
    now
  )

  assert.ok(detected)
  assert.equal(detected.exception_type, "PAYMENT_STUCK")
  const eventId = buildOrderSlaEventId(order.id, detected)
  const first = await scanOrderExceptions(container, now)
  const second = await scanOrderExceptions(container, now)
  const events = await service.listAgentEvents({
    event_id: eventId,
    source: "order-sla-detector",
  })

  assert.equal(events.length, 1)
  assert.ok(first.created >= 1)
  assert.ok(second.duplicates >= 1)

  const incidents = await service.listAgentIncidents({
    trigger_event_id: events[0].id,
  })
  assert.equal(incidents.length, 1)
  const actionRequests = await service.listAgentActionRequests({
    incident_id: incidents[0].id,
    tool_name: "task.create",
  })
  assert.equal(actionRequests.length, 1)

  let action = actionRequests[0]
  if (action.status === "PENDING") {
    const { result } = await executeAgentActionWorkflow(container).run({
      input: {
        action_request_id: action.id,
        actor_id: "order-sla-detector-verifier",
        actor_type: "worker",
        worker_id: "order-sla-detector-verifier",
      },
    })
    action = result.action
  }

  assert.equal(action.status, "SUCCEEDED")
  const tasks = await service.listAgentTasks({
    incident_id: incidents[0].id,
  })
  const orderAfter = await orders.retrieveOrder(order.id)

  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].task_type, "ORDER_PAYMENT_REVIEW")
  assert.equal(orderAfter.status, orderBefore.status)
  assert.equal(orderAfter.version, orderBefore.version)
  assert.equal(orderAfter.canceled_at, orderBefore.canceled_at)

  console.log(
    JSON.stringify(
      {
        action_status: action.status,
        detector_event_id: eventId,
        duplicate_suppressed: second.duplicates >= 1,
        first_scan: first,
        incident_id: incidents[0].id,
        order_id: order.id,
        order_unchanged: true,
        second_scan: second,
        status: "VERIFIED",
        task_id: tasks[0].id,
      },
      null,
      2
    )
  )
}
