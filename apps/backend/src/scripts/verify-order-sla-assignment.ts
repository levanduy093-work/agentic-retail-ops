import assert from "node:assert/strict"
import { createOrderWorkflow } from "@medusajs/core-flows"
import type {
  ExecArgs,
  IEventBusModuleService,
  IOrderModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { scanOrderExceptions } from "../jobs/detect-order-exceptions"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import {
  buildOrderSlaEventId,
  detectOrderSlaException,
} from "../modules/agent-operations/order-exception-detector"
import { executeOrderRead } from "../modules/agent-operations/order-read-runtime"
import {
  ORDER_SLA_POLICY_VERSION,
  resolveOrderSlaPolicy,
} from "../modules/agent-operations/order-sla-assignment"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"

export default async function verifyOrderSlaAssignment({
  container,
}: ExecArgs) {
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const policy = resolveOrderSlaPolicy()
  const { result: created } = await createOrderWorkflow(container).run({
    input: {
      currency_code: "vnd",
      items: [
        {
          is_discountable: false,
          is_tax_inclusive: true,
          quantity: 1,
          requires_shipping: true,
          title: "Automatic order SLA verification item",
          unit_price: 99.99,
        },
      ],
      metadata: {
        purpose: "automatic-order-sla-runtime-verification",
      },
      no_notification: true,
      status: "pending",
    },
  })
  const hookAssignedOrder = await orders.retrieveOrder(created.id, {
    relations: ["items"],
  })
  const hookMetadata = hookAssignedOrder.metadata ?? {}

  assert.equal(hookMetadata.agent_sla_policy_version, ORDER_SLA_POLICY_VERSION)
  await orders.updateOrders(created.id, {
    metadata: {
      purpose: "automatic-order-sla-runtime-verification",
    },
  })
  await eventBus.emit({
    data: { id: created.id },
    name: "order.placed",
  })

  let orderBeforeScan = await orders.retrieveOrder(created.id, {
    relations: ["items"],
  })
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (orderBeforeScan.metadata?.agent_payment_due_at) {
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
    orderBeforeScan = await orders.retrieveOrder(created.id, {
      relations: ["items"],
    })
  }

  const metadata = orderBeforeScan.metadata ?? {}
  const paymentDueAt = metadata.agent_payment_due_at
  const fulfillmentDueAt = metadata.agent_fulfillment_due_at

  assert.ok(typeof paymentDueAt === "string")
  assert.ok(typeof fulfillmentDueAt === "string")
  assert.equal(metadata.agent_sla_policy_version, ORDER_SLA_POLICY_VERSION)
  assert.equal(metadata.agent_sla_source, "medusa-order-created")
  assert.equal(
    Date.parse(paymentDueAt) - new Date(orderBeforeScan.created_at).getTime(),
    policy.payment_sla_minutes * 60_000
  )
  assert.equal(
    Date.parse(fulfillmentDueAt) -
      new Date(orderBeforeScan.created_at).getTime(),
    policy.fulfillment_sla_minutes * 60_000
  )

  const scanAt = new Date(Date.parse(paymentDueAt) + 1_000)
  const read = await executeOrderRead(
    container,
    { order_id: created.id },
    "order-sla-assignment-verifier"
  )
  const detected = detectOrderSlaException(read.output, metadata, scanAt)

  assert.ok(detected)
  assert.equal(detected.exception_type, "PAYMENT_STUCK")
  const eventId = buildOrderSlaEventId(created.id, detected)
  const scan = await scanOrderExceptions(container, scanAt)

  assert.equal(scan.errors, 0)
  const events = await service.listAgentEvents({
    event_id: eventId,
    source: "order-sla-detector",
  })

  assert.equal(events.length, 1)
  const incidents = await service.listAgentIncidents({
    trigger_event_id: events[0].id,
  })

  assert.equal(incidents.length, 1)
  const actions = await service.listAgentActionRequests({
    incident_id: incidents[0].id,
    tool_name: "task.create",
  })

  assert.equal(actions.length, 1)
  const { result: executed } = await executeAgentActionWorkflow(container).run({
    input: {
      action_request_id: actions[0].id,
      actor_id: "order-sla-assignment-verifier",
      actor_type: "worker",
      worker_id: "order-sla-assignment-verifier",
    },
  })

  assert.equal(executed.action.status, "SUCCEEDED")
  const tasks = await service.listAgentTasks({
    incident_id: incidents[0].id,
  })
  const orderAfterScan = await orders.retrieveOrder(created.id)

  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].task_type, "ORDER_PAYMENT_REVIEW")
  assert.equal(orderAfterScan.status, orderBeforeScan.status)
  assert.equal(orderAfterScan.version, orderBeforeScan.version)
  assert.equal(orderAfterScan.canceled_at, orderBeforeScan.canceled_at)

  console.log(
    JSON.stringify(
      {
        action_status: executed.action.status,
        detector_event_id: eventId,
        fulfillment_due_at: fulfillmentDueAt,
        incident_id: incidents[0].id,
        order_id: created.id,
        order_unchanged_after_scan: true,
        payment_due_at: paymentDueAt,
        policy_version: metadata.agent_sla_policy_version,
        scan,
        sources_verified: ["order-created-hook", "order-placed-event"],
        status: "ORDER_SLA_ASSIGNMENT_VERIFIED",
        task_id: tasks[0].id,
      },
      null,
      2
    )
  )
}
