import os from "node:os"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { isAgentDeliveryClaimable } from "../modules/agent-operations/delivery-policy"
import { dispatchAgentDeliveryWorkflow } from "../workflows/agent-operations/dispatch-agent-delivery"

const BATCH_SIZE = 25
const WORKER_ID = `agent-delivery-${os.hostname()}-${process.pid}`

export default async function dispatchAgentDeliveriesJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const now = new Date()

  try {
    const [pending, failed, processing] = await Promise.all([
      service.listAgentDeliveries(
        { status: "PENDING" },
        { order: { available_at: "ASC" }, take: BATCH_SIZE }
      ),
      service.listAgentDeliveries(
        { status: "FAILED" },
        { order: { available_at: "ASC" }, take: BATCH_SIZE }
      ),
      service.listAgentDeliveries(
        { status: "PROCESSING" },
        { order: { lock_expires_at: "ASC" }, take: BATCH_SIZE }
      ),
    ])
    const candidates = [...pending, ...failed, ...processing]
      .filter((delivery) => isAgentDeliveryClaimable(delivery, now))
      .sort(
        (left, right) =>
          new Date(left.available_at).getTime() -
          new Date(right.available_at).getTime()
      )
      .slice(0, BATCH_SIZE)

    let delivered = 0
    let deferred = 0
    for (const delivery of candidates) {
      const { result } = await dispatchAgentDeliveryWorkflow(container).run({
        input: { delivery_id: delivery.id, worker_id: WORKER_ID },
      })
      result.delivered ? (delivered += 1) : (deferred += 1)
    }

    if (candidates.length) {
      logger.info(
        `Agent delivery dispatch completed: ${delivered} delivered, ${deferred} deferred.`
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(`Agent delivery dispatch failed: ${message}`)
  }
}

export const config = {
  name: "dispatch-agent-deliveries",
  schedule: "* * * * *",
}
