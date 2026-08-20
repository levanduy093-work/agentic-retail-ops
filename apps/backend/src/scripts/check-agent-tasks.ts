import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function checkAgentTasks({ container }: ExecArgs) {
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  if (pgConnection) {
    const tasks = await pgConnection("agent_task").select("id", "task_type", "status", "input").limit(100)
    console.log("Agent tasks count:", tasks.length)
    console.log("Sample tasks:", JSON.stringify(tasks.slice(0, 5), null, 2))

    const orderTasks = tasks.filter((t: any) => 
      t.task_type?.includes("ORDER") || 
      JSON.stringify(t.input || {}).includes("ord_")
    )
    console.log(`Order-related agent tasks count: ${orderTasks.length}`)

    const actionRequests = await pgConnection("agent_action_request").select("id", "action_type", "status").limit(100)
    console.log("Agent action requests count:", actionRequests.length)
    console.log("Action types:", [...new Set(actionRequests.map((a: any) => a.action_type))])
  }
}
