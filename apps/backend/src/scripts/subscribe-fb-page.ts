import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function subscribeFbPage({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const connections = await service.listAgentChannelConnections(
    { channel: "MESSENGER" },
    { take: 1 }
  )
  const conn = connections[0]
  if (!conn) {
    console.log("No MESSENGER connection found.")
    return
  }
  const token = await service.resolveChannelBotToken(conn)
  console.log("Found Messenger connection:", conn.id, "Token length:", token.length)

  const url = `https://graph.facebook.com/v19.0/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { method: "POST" })
  const data = await res.json()
  console.log("Subscribed apps response:", data)
}
