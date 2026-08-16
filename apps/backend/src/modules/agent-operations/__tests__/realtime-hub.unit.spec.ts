import { AgentRealtimeHub, RealtimeChatEvent } from "../realtime-hub"

describe("AgentRealtimeHub", () => {
  it("broadcasts message.created to admin and specific conversation subscribers", () => {
    const hub = new AgentRealtimeHub()
    const adminEvents: RealtimeChatEvent[] = []
    const conv1Events: RealtimeChatEvent[] = []
    const conv2Events: RealtimeChatEvent[] = []

    const unsubAdmin = hub.subscribeAdmin((e) => adminEvents.push(e))
    const unsubConv1 = hub.subscribeConversation("conv_1", (e) =>
      conv1Events.push(e)
    )
    const unsubConv2 = hub.subscribeConversation("conv_2", (e) =>
      conv2Events.push(e)
    )

    hub.emitMessageCreated({
      body: "Hello from conv 1",
      channel: "IN_APP",
      conversation_id: "conv_1",
      direction: "INBOUND",
      id: "msg_1",
      message_type: "TEXT",
      occurred_at: "2026-08-16T12:00:00.000Z",
      sender_id: "cust_1",
      sender_type: "customer",
      status: "PROCESSED",
    })

    expect(adminEvents).toHaveLength(1)
    expect(adminEvents[0].type).toBe("message.created")
    expect(adminEvents[0].data).toMatchObject({
      body: "Hello from conv 1",
      conversation_id: "conv_1",
    })

    expect(conv1Events).toHaveLength(1)
    expect(conv1Events[0].data).toMatchObject({
      body: "Hello from conv 1",
    })

    expect(conv2Events).toHaveLength(0)

    unsubAdmin()
    unsubConv1()
    unsubConv2()

    hub.emitMessageCreated({
      body: "After unsub",
      channel: "IN_APP",
      conversation_id: "conv_1",
      direction: "INBOUND",
      id: "msg_2",
      message_type: "TEXT",
      occurred_at: "2026-08-16T12:00:01.000Z",
      sender_id: "cust_1",
      sender_type: "customer",
      status: "PROCESSED",
    })

    expect(adminEvents).toHaveLength(1)
    expect(conv1Events).toHaveLength(1)
  })

  it("broadcasts conversation.updated and task.updated events correctly", () => {
    const hub = new AgentRealtimeHub()
    const adminEvents: RealtimeChatEvent[] = []
    const convEvents: RealtimeChatEvent[] = []

    hub.subscribeAdmin((e) => adminEvents.push(e))
    hub.subscribeConversation("conv_abc", (e) => convEvents.push(e))

    hub.emitConversationUpdated({
      channel: "IN_APP",
      conversation_id: "conv_abc",
      id: "conv_abc",
      last_message_at: "2026-08-16T12:00:00.000Z",
      requires_human_attention: true,
      title: "Test Conversation",
    })

    hub.emitTaskUpdated({
      assigned_to_id: "user_1",
      id: "task_1",
      priority: "HIGH",
      status: "IN_PROGRESS",
      support_conversation_id: "conv_abc",
      task_type: "SUPPORT_RESPONSE_REVIEW",
    })

    expect(adminEvents).toHaveLength(2)
    expect(adminEvents[0].type).toBe("conversation.updated")
    expect(adminEvents[1].type).toBe("task.updated")

    expect(convEvents).toHaveLength(2)
    expect(convEvents[0].type).toBe("conversation.updated")
    expect(convEvents[1].type).toBe("task.updated")
  })
})
