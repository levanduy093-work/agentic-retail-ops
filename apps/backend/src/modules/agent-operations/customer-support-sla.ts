import { AgentTaskStatus } from "./types"

const ACTIVE_TASK_STATUSES: AgentTaskStatus[] = [
  "TODO",
  "CLAIMED",
  "IN_PROGRESS",
  "WAITING",
]

export function isCustomerSupportTaskOverdue(input: {
  due_at: Date | string | null
  escalated_at: Date | string | null
  now: Date
  status: AgentTaskStatus
  task_type: string
}) {
  if (!input.task_type.startsWith("SUPPORT_")) return false
  if (!ACTIVE_TASK_STATUSES.includes(input.status)) return false
  if (input.escalated_at || !input.due_at) return false
  const dueAt = new Date(input.due_at).getTime()
  return Number.isFinite(dueAt) && dueAt <= input.now.getTime()
}
