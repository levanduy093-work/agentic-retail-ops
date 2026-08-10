import assert from "node:assert/strict"
import type { ExecArgs, IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { TaskCommandOutput } from "../modules/agent-operations/tools/task-tools"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { ingestOrderExceptionEventWorkflow } from "../workflows/agent-operations/ingest-order-exception-event"

export default async function verifyOrderExceptionAgent({
  container,
}: ExecArgs) {
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const candidates = await orders.listOrders({}, { take: 100 })
  const order = candidates.find(
    (candidate) =>
      !["archived", "canceled", "completed"].includes(candidate.status)
  )

  if (!order) {
    console.log(
      JSON.stringify(
        {
          checked_orders: candidates.length,
          reason: "No non-terminal local order is available.",
          status: "SKIPPED_NO_ACTIONABLE_ORDER",
        },
        null,
        2
      )
    )
    return
  }

  const verificationId = `verify-order-exception-${Date.now()}`
  const input = {
    correlation_id: verificationId,
    event_id: verificationId,
    event_type: "order.exception" as const,
    event_version: 1,
    occurred_at: new Date().toISOString(),
    payload: {
      detected_at: new Date().toISOString(),
      exception_type: "MANUAL_REVIEW" as const,
      order_id: order.id,
    },
    source: "order-exception-runtime-verifier",
    subject_id: order.id,
    subject_type: "order" as const,
    tenant_id: "default",
  }
  const { result: first } = await ingestOrderExceptionEventWorkflow(
    container
  ).run({ input })

  assert.equal(first.duplicate, false)
  assert.equal(first.live_order.order_id, order.id)
  assert.ok(first.recommendation)
  assert.equal(first.recommendation.action_type, "CREATE_TASK")
  assert.equal(first.action_request?.tool_name, "task.create")
  assert.equal(first.action_request?.status, "PENDING")

  const { result: duplicate } = await ingestOrderExceptionEventWorkflow(
    container
  ).run({ input })
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.incident?.id, first.incident.id)
  assert.equal(duplicate.action_request?.id, first.action_request?.id)

  assert.ok(first.action_request)
  const { result: execution } = await executeAgentActionWorkflow(container).run(
    {
      input: {
        action_request_id: first.action_request.id,
        actor_id: "order-exception-runtime-worker",
        actor_type: "worker",
        worker_id: "order-exception-runtime-worker",
      },
    }
  )
  const output = execution.action.result as unknown as TaskCommandOutput
  assert.equal(output.outcome, "SUCCEEDED")
  const tasks = await service.listAgentTasks({ incident_id: first.incident.id })
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].id, output.task.task_id)
  assert.equal(tasks[0].task_type, "ORDER_MANUAL_REVIEW")

  console.log(
    JSON.stringify(
      {
        action_request_id: first.action_request.id,
        action_status: execution.action.status,
        duplicate_suppressed: duplicate.duplicate,
        incident_id: first.incident.id,
        live_order_version: first.live_order.version,
        order_id: order.id,
        status: "VERIFIED",
        task_id: tasks[0].id,
      },
      null,
      2
    )
  )
}
