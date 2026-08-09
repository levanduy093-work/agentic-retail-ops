import os from "node:os"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { isOutboxEventClaimable } from "../modules/agent-operations/outbox-policy"
import { dispatchAgentOutboxEventWorkflow } from "../workflows/agent-operations/dispatch-agent-outbox-event"

const BATCH_SIZE = 25
const WORKER_ID = `agent-outbox-${os.hostname()}-${process.pid}`

export default async function dispatchAgentOutboxJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const now = new Date()

  try {
    const [pending, failed, processing] = await Promise.all([
      service.listAgentOutboxEvents(
        { status: "PENDING" },
        { order: { available_at: "ASC" }, take: BATCH_SIZE }
      ),
      service.listAgentOutboxEvents(
        { status: "FAILED" },
        { order: { available_at: "ASC" }, take: BATCH_SIZE }
      ),
      service.listAgentOutboxEvents(
        { status: "PROCESSING" },
        { order: { lock_expires_at: "ASC" }, take: BATCH_SIZE }
      ),
    ])
    const candidates = [...pending, ...failed, ...processing]
      .filter((event) => isOutboxEventClaimable(event, now))
      .sort(
        (left, right) =>
          new Date(left.available_at).getTime() -
          new Date(right.available_at).getTime()
      )
      .slice(0, BATCH_SIZE)

    if (!candidates.length) {
      return
    }

    let delivered = 0
    let deferred = 0

    for (const event of candidates) {
      const { result } = await dispatchAgentOutboxEventWorkflow(container).run({
        input: {
          event_id: event.id,
          worker_id: WORKER_ID,
        },
      })

      if (result.delivered) {
        delivered += 1
      } else {
        deferred += 1
      }
    }

    logger.info(
      `Agent outbox dispatch completed: ${delivered} delivered, ${deferred} deferred.`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(`Agent outbox dispatch failed: ${message}`)
  }
}

export const config = {
  name: "dispatch-agent-outbox",
  schedule: "* * * * *",
}
