import type { ILockingModule, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { isCustomerSupportTaskOverdue } from "../modules/agent-operations/customer-support-sla"
import { escalateOverdueCustomerSupportTaskWorkflow } from "../workflows/agent-operations/escalate-overdue-customer-support-task"

const ACTIVE_STATUSES = ["TODO", "CLAIMED", "IN_PROGRESS", "WAITING"] as const
const SCAN_LIMIT = 100

export default async function escalateOverdueCustomerSupportTasks(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const now = new Date()
  const batches = await Promise.all(
    ACTIVE_STATUSES.map((status) =>
      service.listAgentTasks(
        { status },
        { order: { due_at: "ASC" }, take: SCAN_LIMIT }
      )
    )
  )
  let escalated = 0

  for (const task of batches.flat()) {
    if (
      !isCustomerSupportTaskOverdue({
        due_at: task.due_at,
        escalated_at: task.escalated_at,
        now,
        status: task.status,
        task_type: task.task_type,
      })
    ) {
      continue
    }
    await locking.execute(
      `customer-support-sla:${task.id}`,
      async () => {
        const { result } = await escalateOverdueCustomerSupportTaskWorkflow(
          container
        ).run({ input: { task_id: task.id } })
        if (result.escalated) escalated += 1
      },
      { timeout: 30 }
    )
  }

  if (escalated) {
    logger.warn(`Escalated ${escalated} overdue customer support task(s).`)
  }
}

export const config = {
  name: "escalate-overdue-customer-support-tasks",
  schedule: "* * * * *",
}
