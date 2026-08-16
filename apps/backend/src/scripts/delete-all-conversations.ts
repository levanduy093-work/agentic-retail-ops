import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function deleteAllConversations({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  console.log("Starting deletion of all conversation data...")

  // 1. List all conversations
  const conversations = await service.listAgentConversations({}, { take: 10000 })
  const conversationIds = conversations.map((c) => c.id)

  // 2. List all messages
  const messages = await service.listAgentMessages({}, { take: 50000 })
  const messageIds = messages.map((m) => m.id)

  // 3. List all conversation memories
  const memories = await service.listAgentConversationMemories({}, { take: 10000 })
  const memoryIds = memories.map((m) => m.id)

  // 4. List all customer preferences linked to conversations
  const preferences = await service.listAgentCustomerPreferences({}, { take: 10000 })
  const preferenceIds = preferences.map((p) => p.id)

  // 5. List all support review tasks and tasks linked to conversations
  const tasks = await service.listAgentTasks({}, { take: 10000 })
  const convTasks = tasks.filter(
    (t) =>
      t.task_type === "SUPPORT_RESPONSE_REVIEW" ||
      (t.conversation_id && conversationIds.includes(t.conversation_id)) ||
      (t.input && typeof t.input === "object" && "conversation_id" in t.input)
  )
  const taskIds = convTasks.map((t) => t.id)

  // 6. List deliveries linked to messages
  const deliveries = await service.listAgentDeliveries({}, { take: 50000 })
  const convDeliveries = deliveries.filter(
    (d) => !d.message_id || messageIds.includes(d.message_id)
  )
  const deliveryIds = convDeliveries.map((d) => d.id)

  console.log(`Found:
- ${conversationIds.length} conversations
- ${messageIds.length} messages
- ${memoryIds.length} memories
- ${preferenceIds.length} customer preferences
- ${taskIds.length} support review / conversation tasks
- ${deliveryIds.length} message deliveries`)

  if (deliveryIds.length > 0) {
    await service.deleteAgentDeliveries(deliveryIds)
    console.log(`Deleted ${deliveryIds.length} deliveries.`)
  }

  if (taskIds.length > 0) {
    await service.deleteAgentTasks(taskIds)
    console.log(`Deleted ${taskIds.length} tasks.`)
  }

  if (preferenceIds.length > 0) {
    await service.deleteAgentCustomerPreferences(preferenceIds)
    console.log(`Deleted ${preferenceIds.length} preferences.`)
  }

  if (memoryIds.length > 0) {
    await service.deleteAgentConversationMemories(memoryIds)
    console.log(`Deleted ${memoryIds.length} memories.`)
  }

  if (messageIds.length > 0) {
    await service.deleteAgentMessages(messageIds)
    console.log(`Deleted ${messageIds.length} messages.`)
  }

  if (conversationIds.length > 0) {
    await service.deleteAgentConversations(conversationIds)
    console.log(`Deleted ${conversationIds.length} conversations.`)
  }

  console.log("All conversation data deleted successfully.")
}
