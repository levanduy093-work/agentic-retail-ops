import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { dispatchAgentDeliveryWorkflow } from "../workflows/agent-operations/dispatch-agent-delivery"

export default async function runAgentWorker({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const workerId = `agent-worker-${process.pid}-${Date.now().toString(36)}`
  const pollIntervalMs = Number(process.env.AGENT_WORKER_POLL_INTERVAL_MS) || 3000
  let isRunning = true

  console.log(`[AgentWorker] Starting dedicated background worker: ${workerId}`)
  console.log(`[AgentWorker] Polling interval: ${pollIntervalMs}ms`)

  const handleShutdown = (signal: string) => {
    console.log(`[AgentWorker] Received ${signal}. Shutting down gracefully...`)
    isRunning = false
  }

  process.on("SIGINT", () => handleShutdown("SIGINT"))
  process.on("SIGTERM", () => handleShutdown("SIGTERM"))

  let iteration = 0
  while (isRunning) {
    iteration++
    try {
      // 1. Process pending agent actions (commands, proposals, transfers)
      const pendingActions = await service.listAgentActionRequests(
        { status: "PENDING" },
        { take: 10 }
      )

      if (pendingActions.length > 0) {
        console.log(
          `[AgentWorker] Iteration ${iteration}: Found ${pendingActions.length} pending action(s).`
        )
        for (const action of pendingActions) {
          if (!isRunning) break
          try {
            console.log(
              `[AgentWorker] Claiming and executing action ${action.id} (${action.tool_name})...`
            )
            await executeAgentActionWorkflow(container).run({
              input: {
                action_request_id: action.id,
                actor_id: workerId,
                actor_type: "worker",
                worker_id: workerId,
              },
            })
            console.log(`[AgentWorker] Successfully processed action ${action.id}`)
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(
              `[AgentWorker] Error executing action ${action.id}: ${message}`
            )
          }
        }
      }

      // 2. Process pending outbox deliveries
      const pendingDeliveries = await service.listAgentDeliveries(
        { status: "PENDING" },
        { take: 10 }
      )

      if (pendingDeliveries.length > 0) {
        console.log(
          `[AgentWorker] Iteration ${iteration}: Found ${pendingDeliveries.length} pending delivery(ies).`
        )
        for (const delivery of pendingDeliveries) {
          if (!isRunning) break
          try {
            console.log(`[AgentWorker] Dispatching delivery ${delivery.id}...`)
            await dispatchAgentDeliveryWorkflow(container).run({
              input: {
                delivery_id: delivery.id,
                worker_id: workerId,
              },
            })
            console.log(
              `[AgentWorker] Successfully dispatched delivery ${delivery.id}`
            )
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(
              `[AgentWorker] Error dispatching delivery ${delivery.id}: ${message}`
            )
          }
        }
      }
    } catch (loopErr: unknown) {
      const message = loopErr instanceof Error ? loopErr.message : String(loopErr)
      console.error(`[AgentWorker] Loop error on iteration ${iteration}: ${message}`)
    }

    if (isRunning) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }

  console.log(`[AgentWorker] Worker ${workerId} shutdown complete.`)
}
