import { MedusaContainer } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "./src/modules/agent-operations"
import AgentOperationsModuleService from "./src/modules/agent-operations/service"

export default async function myScript({
  container,
}: {
  container: MedusaContainer
}) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const convos = await service.listAgentConversations({
    channel: "MESSENGER",
  })
  for (const conv of convos) {
    if (conv.title && conv.title.match(/^Facebook — \d+$/)) {
      const psid = conv.title.split(" — ")[1]
      const connectionId = (conv.metadata as Record<string, unknown> | null)
        ?.connection_id
      if (!psid || typeof connectionId !== "string") continue

      const conn = await service.retrieveAgentChannelConnection(connectionId)
      const token = await service.resolveChannelBotToken(conn)
      const res = await fetch(
        `https://graph.facebook.com/${psid}?fields=name&access_token=${token}`
      )
      if (res.ok) {
        const data = (await res.json()) as { name?: unknown }
        if (typeof data.name === "string" && data.name.trim()) {
          await service.updateAgentConversations({
            id: conv.id,
            title: `Facebook — ${data.name.trim()}`,
          })
          console.log(`Updated ${psid} to ${data.name.trim()}`)
        }
      }
    }
  }
}
