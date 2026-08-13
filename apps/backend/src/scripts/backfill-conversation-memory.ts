import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { refreshConversationMemoryWorkflow } from "../workflows/agent-operations/refresh-conversation-memory"

export default async function backfillConversationMemory({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const conversations = await service.listAgentConversations(
    {
      status: "OPEN",
      topic_type: ["CUSTOMER_SUPPORT", "CUSTOMER_SUPPORT_CHAT"],
    },
    { order: { last_message_at: "DESC" }, take: 100 }
  )
  let updated = 0
  let skipped = 0

  for (const conversation of conversations) {
    const { result } = await refreshConversationMemoryWorkflow(container).run({
      input: { conversation_id: conversation.id },
    })
    if (result.updated) updated += 1
    else skipped += 1
  }

  console.log(
    JSON.stringify(
      {
        conversations: conversations.length,
        skipped,
        status: "CONVERSATION_MEMORY_BACKFILLED",
        updated,
      },
      null,
      2
    )
  )
}
