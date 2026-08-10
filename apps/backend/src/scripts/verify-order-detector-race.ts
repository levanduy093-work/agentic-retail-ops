import assert from "node:assert/strict"
import type { ExecArgs, IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  buildOrderSlaEventId,
  detectOrderSlaException,
} from "../modules/agent-operations/order-exception-detector"
import { executeOrderRead } from "../modules/agent-operations/order-read-runtime"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function verifyOrderDetectorRace({
  container,
}: ExecArgs) {
  const raceKey = process.env.ORDER_DETECTOR_RACE_KEY

  assert.ok(raceKey, "ORDER_DETECTOR_RACE_KEY is required")
  assert.equal(
    process.env.REDIS_INFRASTRUCTURE_ENABLED,
    "true",
    "Redis infrastructure must be enabled for the race verification"
  )

  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const recentOrders = await orders.listOrders(
    {},
    {
      order: { created_at: "DESC" },
      select: ["id", "metadata"],
      take: 500,
    }
  )
  const order = recentOrders.find(
    (candidate) => candidate.metadata?.agent_detector_race_key === raceKey
  )

  assert.ok(order, `No race verification order found for ${raceKey}`)
  const read = await executeOrderRead(
    container,
    { order_id: order.id },
    "order-detector-race-verifier"
  )
  const detected = detectOrderSlaException(read.output, order.metadata, new Date())

  assert.ok(detected)
  const eventId = buildOrderSlaEventId(order.id, detected)
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
  console.log(
    JSON.stringify(
      {
        action_request_id: actions[0].id,
        detector_event_id: eventId,
        event_count: events.length,
        incident_count: incidents.length,
        incident_id: incidents[0].id,
        order_id: order.id,
        race_key: raceKey,
        status: "REDIS_RACE_VERIFIED",
      },
      null,
      2
    )
  )
}
