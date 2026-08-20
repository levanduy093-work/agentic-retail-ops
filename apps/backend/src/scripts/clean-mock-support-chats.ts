import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function cleanMockSupportChats({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  console.log("Cleaning up mock support conversations...")
  const allConversations = await service.listAgentConversations(
    {},
    { take: 1000 }
  )

  const mockConversations = allConversations.filter(
    (c) =>
      (typeof c.topic_id === "string" && c.topic_id.startsWith("sample:")) ||
      (typeof c.title === "string" && (
        c.title.includes("Nguyễn Thị Mai") ||
        c.title.includes("Trần Minh Quang") ||
        c.title.includes("Phạm Hoàng Anh") ||
        c.title.includes("Lê Thu Hà")
      ))
  )

  console.log(`Found ${mockConversations.length} mock conversations to delete.`)

  for (const conv of mockConversations) {
    const msgs = await service.listAgentMessages(
      { conversation_id: conv.id },
      { take: 100 }
    )
    if (msgs.length > 0) {
      await service.deleteAgentMessages(msgs.map((m) => m.id))
    }

    const tasks = await service.listAgentTasks(
      { conversation_id: conv.id },
      { take: 100 }
    )
    if (tasks.length > 0) {
      await service.deleteAgentTasks(tasks.map((t) => t.id))
    }

    const memories = await service.listAgentConversationMemories(
      { conversation_id: conv.id },
      { take: 10 }
    )
    if (memories.length > 0) {
      await service.deleteAgentConversationMemories(memories.map((m) => m.id))
    }

    await service.deleteAgentConversations([conv.id])
    console.log(`Deleted mock conversation: ${conv.title} (${conv.id})`)
  }

  console.log("Mock support conversations cleaned up successfully!")
}
