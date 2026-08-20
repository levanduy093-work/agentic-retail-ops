import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function seedSampleSupportChats({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  console.log("Cleaning up any existing sample conversations...")
  const sampleTopicIds = [
    "sample:zalo:chat:001",
    "sample:tg:chat:002",
    "sample:web:chat:003",
    "sample:tg:chat:004",
  ]

  for (const topicId of sampleTopicIds) {
    const existing = await service.listAgentConversations(
      { topic_id: topicId },
      { take: 10 }
    )
    for (const conv of existing) {
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
      await service.deleteAgentConversations([conv.id])
    }
  }

  console.log("Seeding realistic sample support conversations...")
  const now = Date.now()

  // 1. Nguyễn Thị Mai - ZALO (New unreplied message -> Green dot)
  const conv1Time = new Date(now - 10 * 60 * 1000)
  const conv1 = await service.createAgentConversations({
    channel: "ZALO",
    external_thread_id: "zalo_user_001",
    last_message_at: conv1Time,
    metadata: {
      customer_name: "Nguyễn Thị Mai",
      principal_role: "CUSTOMER",
      zalo_user_id: "zalo_user_001",
    },
    opened_at: new Date(now - 60 * 60 * 1000),
    status: "OPEN",
    tenant_id: "default",
    title: "Zalo — Nguyễn Thị Mai",
    topic_id: "sample:zalo:chat:001",
    topic_type: "CUSTOMER_SUPPORT_CHAT",
  })

  await service.createAgentMessages({
    body: "Shop ơi cho mình hỏi áo thun trơn size L còn màu đen không ạ?",
    channel: "ZALO",
    conversation_id: conv1.id,
    direction: "INBOUND",
    idempotency_key: `sample:msg:${conv1.id}:1`,
    message_type: "TEXT",
    occurred_at: conv1Time,
    processed_at: conv1Time,
    sender_id: "zalo_user_001",
    sender_type: "user",
    status: "PROCESSED",
  })
  console.log("Created Conv 1 (Unreplied / New Message -> Green dot):", conv1.title)

  // 2. Trần Minh Quang - TELEGRAM (Answered -> Grayed out / No dot)
  const conv2Time1 = new Date(now - 90 * 60 * 1000)
  const conv2Time2 = new Date(now - 80 * 60 * 1000)
  const conv2 = await service.createAgentConversations({
    channel: "TELEGRAM",
    external_thread_id: "tg_user_002",
    last_message_at: conv2Time2,
    metadata: {
      customer_name: "Trần Minh Quang",
      principal_role: "CUSTOMER",
      telegram_chat_id: "tg_user_002",
      telegram_username: "minhquang_tran",
    },
    opened_at: conv2Time1,
    status: "OPEN",
    tenant_id: "default",
    title: "Telegram — Trần Minh Quang",
    topic_id: "sample:tg:chat:002",
    topic_type: "CUSTOMER_SUPPORT_CHAT",
  })

  await service.createAgentMessages({
    body: "Cho mình hỏi đơn hàng #1002 giao tới đâu rồi shop?",
    channel: "TELEGRAM",
    conversation_id: conv2.id,
    direction: "INBOUND",
    idempotency_key: `sample:msg:${conv2.id}:1`,
    message_type: "TEXT",
    occurred_at: conv2Time1,
    processed_at: conv2Time1,
    sender_id: "tg_user_002",
    sender_type: "user",
    status: "PROCESSED",
  })

  await service.createAgentMessages({
    body: "Dạ đơn hàng #1002 của bạn đang trên đường giao, dự kiến đến trong chiều nay ạ!",
    channel: "TELEGRAM",
    conversation_id: conv2.id,
    direction: "OUTBOUND",
    idempotency_key: `sample:msg:${conv2.id}:2`,
    message_type: "TEXT",
    occurred_at: conv2Time2,
    processed_at: conv2Time2,
    sender_id: "customer-knowledge-agent",
    sender_type: "agent",
    status: "PROCESSED",
  })
  console.log("Created Conv 2 (Answered -> Grayed out / No dot):", conv2.title)

  // 3. Phạm Hoàng Anh - STOREFRONT (AI Paused -> Orange dot)
  const conv3Time1 = new Date(now - 45 * 60 * 1000)
  const conv3Time2 = new Date(now - 30 * 60 * 1000)
  const conv3 = await service.createAgentConversations({
    channel: "IN_APP",
    external_thread_id: "web_cust_003",
    last_message_at: conv3Time2,
    metadata: {
      ai_paused: true,
      ai_paused_at: conv3Time2.toISOString(),
      ai_paused_by: "support_staff",
      customer_name: "Phạm Hoàng Anh",
      principal_role: "CUSTOMER",
    },
    opened_at: conv3Time1,
    status: "OPEN",
    tenant_id: "default",
    title: "Storefront — Phạm Hoàng Anh",
    topic_id: "sample:web:chat:003",
    topic_type: "CUSTOMER_SUPPORT_CHAT",
  })

  await service.createAgentMessages({
    body: "Mình muốn đổi địa chỉ nhận hàng gấp vì mai mình đi công tác.",
    channel: "IN_APP",
    conversation_id: conv3.id,
    direction: "INBOUND",
    idempotency_key: `sample:msg:${conv3.id}:1`,
    message_type: "TEXT",
    occurred_at: conv3Time1,
    processed_at: conv3Time1,
    sender_id: "web_cust_003",
    sender_type: "user",
    status: "PROCESSED",
  })

  await service.createAgentMessages({
    body: "Dạ bạn gửi lại địa chỉ mới giúp mình để nhân viên cập nhật ngay nhé ạ.",
    channel: "IN_APP",
    conversation_id: conv3.id,
    direction: "OUTBOUND",
    idempotency_key: `sample:msg:${conv3.id}:2`,
    message_type: "TEXT",
    occurred_at: conv3Time2,
    processed_at: conv3Time2,
    sender_id: "support_staff",
    sender_type: "user",
    status: "PROCESSED",
    structured_content: { direct_staff_reply: true },
  })
  console.log("Created Conv 3 (AI Paused -> Orange dot):", conv3.title)

  // 4. Lê Thu Hà - TELEGRAM (Needs human attention / Open review task -> Orange dot in Attention tab)
  const conv4Time = new Date(now - 5 * 60 * 1000)
  const conv4 = await service.createAgentConversations({
    channel: "TELEGRAM",
    external_thread_id: "tg_user_004",
    last_message_at: conv4Time,
    metadata: {
      customer_name: "Lê Thu Hà",
      principal_role: "CUSTOMER",
      telegram_chat_id: "tg_user_004",
      telegram_username: "thuha_le",
    },
    opened_at: conv4Time,
    status: "OPEN",
    tenant_id: "default",
    title: "Telegram — Lê Thu Hà",
    topic_id: "sample:tg:chat:004",
    topic_type: "CUSTOMER_SUPPORT_CHAT",
  })

  await service.createAgentMessages({
    body: "Shop hỗ trợ hoàn tiền đơn hàng bị lỗi giúp mình với ạ!",
    channel: "TELEGRAM",
    conversation_id: conv4.id,
    direction: "INBOUND",
    idempotency_key: `sample:msg:${conv4.id}:1`,
    message_type: "TEXT",
    occurred_at: conv4Time,
    processed_at: conv4Time,
    sender_id: "tg_user_004",
    sender_type: "user",
    status: "PROCESSED",
  })

  await service.createAgentTasks({
    conversation_id: conv4.id,
    created_by_id: "customer-knowledge-agent",
    created_by_type: "agent",
    description: "Khách hàng yêu cầu hoàn tiền cho đơn hàng gặp sự cố.",
    due_at: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    idempotency_key: `sample:task:${conv4.id}:review`,
    input: {
      channel: "TELEGRAM",
      conversation_id: conv4.id,
      customer_id: "tg_user_004",
      draft: "Dạ shop đã tiếp nhận yêu cầu hoàn tiền của bạn. Nhân viên CSKH sẽ kiểm tra và đối soát ngay ạ.",
      question: "Shop hỗ trợ hoàn tiền đơn hàng bị lỗi giúp mình với ạ!",
      requires_human_review: true,
    },
    priority: "HIGH",
    status: "TODO",
    task_type: "SUPPORT_RESPONSE_REVIEW",
    tenant_id: "default",
    title: "Duyệt phản hồi hoàn tiền — Lê Thu Hà",
  })
  console.log("Created Conv 4 (Needs Human -> Orange dot in Attention tab):", conv4.title)

  console.log("All sample support chats seeded successfully!")
}
