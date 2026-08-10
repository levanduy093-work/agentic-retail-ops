import os from "node:os"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { isTaskOverdueForEscalation } from "../modules/agent-operations/supervisor-policy"
import { TASK_ESCALATE_TOOL } from "../modules/agent-operations/tools/task-tools"
import { expireAgentApprovalWorkflow } from "../workflows/agent-operations/expire-agent-approval"
import { requestAgentActionWorkflow } from "../workflows/agent-operations/request-agent-action"

const BATCH_SIZE = 50
const SUPERVISOR_ID = `agent-supervisor-${os.hostname()}-${process.pid}`

export default async function superviseAgentOperationsJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const now = new Date()
  const [approvals, ...taskGroups] = await Promise.all([
    service.listAgentApprovals(
      { status: "PENDING" },
      { order: { expires_at: "ASC" }, take: BATCH_SIZE }
    ),
    ...(["TODO", "CLAIMED", "IN_PROGRESS", "WAITING", "FAILED"] as const).map(
      (status) =>
        service.listAgentTasks(
          { status },
          { order: { due_at: "ASC" }, take: BATCH_SIZE }
        )
    ),
  ])

  let expiredApprovals = 0
  for (const approval of approvals.filter(
    (candidate) => new Date(candidate.expires_at) <= now
  )) {
    try {
      const { result } = await expireAgentApprovalWorkflow(container).run({
        input: {
          actor_id: SUPERVISOR_ID,
          approval_id: approval.id,
          expired_at: now.toISOString(),
        },
      })
      expiredApprovals += result.expired ? 1 : 0
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`Approval ${approval.id} supervision failed: ${message}`)
    }
  }

  const overdueTasks = taskGroups
    .flat()
    .filter((task) => isTaskOverdueForEscalation(task, now))
    .sort(
      (left, right) =>
        new Date(left.due_at!).getTime() - new Date(right.due_at!).getTime()
    )
    .slice(0, BATCH_SIZE)
  let escalationRequests = 0
  for (const task of overdueTasks) {
    try {
      const { result } = await requestAgentActionWorkflow(container).run({
        input: {
          correlation_id: task.incident_id ?? task.idempotency_key,
          granted_permissions: [TASK_ESCALATE_TOOL.permission],
          idempotency_key: `supervisor:${task.id}:deadline:${new Date(
            task.due_at!
          ).toISOString()}`,
          incident_id: task.incident_id ?? undefined,
          input: {
            assigned_to_id: "team_operations_manager",
            assigned_to_type: "team",
            expected_status: task.status,
            priority: "CRITICAL",
            reason: `Task exceeded due_at ${new Date(task.due_at!).toISOString()}`,
            task_id: task.id,
          },
          requested_by_id: SUPERVISOR_ID,
          requested_by_type: "system",
          tenant_id: task.tenant_id,
          tool_name: TASK_ESCALATE_TOOL.name,
          tool_version: TASK_ESCALATE_TOOL.version,
        },
      })
      escalationRequests += result.duplicate ? 0 : 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`Task ${task.id} supervision failed: ${message}`)
    }
  }

  if (expiredApprovals || escalationRequests) {
    logger.info(
      `Agent supervision completed: ${expiredApprovals} approvals expired, ${escalationRequests} escalation requests created.`
    )
  }
}

export const config = {
  name: "supervise-agent-operations",
  schedule: "* * * * *",
}
