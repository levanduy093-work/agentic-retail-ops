export function isTaskOverdueForEscalation(
  task: {
    assigned_to_id?: string | null
    assigned_to_type?: string | null
    due_at?: Date | string | null
    priority: string
    status: string
  },
  now: Date
) {
  if (
    !task.due_at ||
    ["COMPLETED", "CANCELLED", "DEAD"].includes(task.status) ||
    new Date(task.due_at) > now
  ) {
    return false
  }

  return !(
    task.priority === "CRITICAL" &&
    task.assigned_to_type === "team" &&
    task.assigned_to_id === "team_operations_manager"
  )
}
