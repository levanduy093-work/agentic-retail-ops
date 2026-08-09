import os from "node:os"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isAgentActionClaimable } from "../modules/agent-operations/action-policy"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"

const BATCH_SIZE = 10
const WORKER_ID = `agent-action-${os.hostname()}-${process.pid}`

export default async function executeAgentActionsJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const now = new Date()
  const [pending, failed, processing] = await Promise.all([
    service.listAgentActionRequests(
      { status: "PENDING" },
      { order: { available_at: "ASC" }, take: BATCH_SIZE }
    ),
    service.listAgentActionRequests(
      { status: "FAILED" },
      { order: { available_at: "ASC" }, take: BATCH_SIZE }
    ),
    service.listAgentActionRequests(
      { status: "PROCESSING" },
      { order: { lock_expires_at: "ASC" }, take: BATCH_SIZE }
    ),
  ])
  const candidates = [...pending, ...failed, ...processing]
    .filter((action) => isAgentActionClaimable(action, now))
    .sort(
      (left, right) =>
        new Date(left.available_at).getTime() -
        new Date(right.available_at).getTime()
    )
    .slice(0, BATCH_SIZE)

  if (!candidates.length) {
    return
  }

  let completed = 0
  let deferred = 0

  for (const action of candidates) {
    try {
      const { result } = await executeAgentActionWorkflow(container).run({
        input: {
          action_request_id: action.id,
          actor_id: WORKER_ID,
          actor_type: "worker",
          worker_id: WORKER_ID,
        },
      })

      if (result.skipped) {
        deferred += 1
      } else {
        completed += 1
      }
    } catch (error) {
      deferred += 1
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`Agent action ${action.id} failed: ${message}`)
    }
  }

  logger.info(
    `Agent action execution completed: ${completed} finalized, ${deferred} deferred.`
  )
}

export const config = {
  name: "execute-agent-actions",
  schedule: "* * * * *",
}
