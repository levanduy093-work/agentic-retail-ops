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
