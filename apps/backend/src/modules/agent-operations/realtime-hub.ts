import { EventEmitter } from "node:events"

export type RealtimeChatEvent =
  | {
      data: {
        channel: string
        conversation_id: string
        id: string
        last_message_at: string
        requires_human_attention: boolean
        title: string
      }
      type: "conversation.updated"
    }
  | {
      data: {
        body: string
        channel: string
        conversation_id: string
        direction: "INBOUND" | "OUTBOUND"
        id: string
        message_type: string
        occurred_at: string
        product_media?: Array<{
          image_url: string
          product_id: string
          product_url?: string | null
          title: string
        }>
        sender_id: string
        sender_type: string
        status: string
        structured_content?: Record<string, unknown> | null
      }
      type: "message.created"
    }
  | {
      data: {
        assigned_to_id: string | null
        id: string
        priority: string
        status: string
        support_conversation_id: string | null
        task_type: string
      }
      type: "task.updated"
    }
  | {
      data: {
        timestamp: string
      }
      type: "ping"
    }

export type RealtimeListener = (event: RealtimeChatEvent) => void

export class AgentRealtimeHub {
  private readonly emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(200)
  }

  subscribeAdmin(listener: RealtimeListener): () => void {
    const channel = "admin:all"
    this.emitter.on(channel, listener)
    return () => {
      this.emitter.off(channel, listener)
    }
  }

  subscribeConversation(
    conversationId: string,
    listener: RealtimeListener
  ): () => void {
    const channel = `conversation:${conversationId}`
    this.emitter.on(channel, listener)
    return () => {
      this.emitter.off(channel, listener)
    }
  }

  emitMessageCreated(payload: Extract<RealtimeChatEvent, { type: "message.created" }>["data"]): void {
    const event: RealtimeChatEvent = {
      data: payload,
      type: "message.created",
    }
    this.emitter.emit("admin:all", event)
    if (payload.conversation_id) {
      this.emitter.emit(`conversation:${payload.conversation_id}`, event)
    }
  }

  emitConversationUpdated(payload: Extract<RealtimeChatEvent, { type: "conversation.updated" }>["data"]): void {
    const event: RealtimeChatEvent = {
      data: payload,
      type: "conversation.updated",
    }
    this.emitter.emit("admin:all", event)
    if (payload.conversation_id) {
      this.emitter.emit(`conversation:${payload.conversation_id}`, event)
    }
  }

  emitTaskUpdated(payload: Extract<RealtimeChatEvent, { type: "task.updated" }>["data"]): void {
    const event: RealtimeChatEvent = {
      data: payload,
      type: "task.updated",
    }
    this.emitter.emit("admin:all", event)
    if (payload.support_conversation_id) {
      this.emitter.emit(`conversation:${payload.support_conversation_id}`, event)
    }
  }
}

export const agentRealtimeHub = new AgentRealtimeHub()
