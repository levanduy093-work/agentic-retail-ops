import { MedusaError } from "@medusajs/framework/utils"
import { AgentTaskStatus } from "./types"

const TASK_TRANSITIONS: Record<AgentTaskStatus, AgentTaskStatus[]> = {
  TODO: ["CLAIMED", "CANCELLED"],
  CLAIMED: ["IN_PROGRESS", "TODO", "CANCELLED"],
  IN_PROGRESS: ["WAITING", "COMPLETED", "FAILED", "CANCELLED"],
  WAITING: ["IN_PROGRESS", "FAILED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: ["TODO", "DEAD"],
  DEAD: [],
}

export function assertAgentTaskTransition(
  from: AgentTaskStatus,
  to: AgentTaskStatus
) {
  if (!TASK_TRANSITIONS[from].includes(to)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Invalid agent task transition: ${from} -> ${to}`
    )
  }
}

export function assertAgentTaskRelease(
  task: {
    assigned_to_id?: string | null
    assigned_to_type?: string | null
    status: AgentTaskStatus
  },
  actorId: string
) {
  if (
    task.assigned_to_type !== "user" ||
    task.assigned_to_id !== actorId
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only the employee handling this task can return it to the queue."
    )
  }

  if (!["CLAIMED", "IN_PROGRESS", "WAITING"].includes(task.status)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only an active task can be returned to the queue."
    )
  }
}
