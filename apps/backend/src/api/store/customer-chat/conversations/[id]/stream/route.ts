import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  agentRealtimeHub,
  RealtimeChatEvent,
} from "../../../../../../modules/agent-operations/realtime-hub"
import { AGENT_OPERATIONS_MODULE } from "../../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../../modules/agent-operations/service"
import { assertCustomerChatConversationOwnership } from "../../../../../../modules/agent-operations/customer-chat-ownership"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const conversationId = req.params.id
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const conversation = await service.retrieveAgentConversation(conversationId)
  assertCustomerChatConversationOwnership(
    conversation,
    req.auth_context.actor_id
  )

  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as unknown as { flushHeaders: () => void }).flushHeaders()
  }

  const sendEvent = (event: RealtimeChatEvent) => {
    res.write(`event: ${event.type}\n`)
    res.write(`data: ${JSON.stringify(event.data)}\n\n`)
  }

  // Send initial connected event
  sendEvent({
    data: { timestamp: new Date().toISOString() },
    type: "ping",
  })

  // Subscribe to this specific conversation
  const unsubscribe = agentRealtimeHub.subscribeConversation(
    conversationId,
    sendEvent
  )

  // Keep-alive heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
    } catch {
      clearInterval(heartbeat)
      unsubscribe()
    }
  }, 15_000)

  req.on("close", () => {
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  })
}
