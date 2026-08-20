import os from "node:os"
import type { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { dispatchAgentDeliveryWorkflow } from "./dispatch-agent-delivery"
import { refreshConversationMemoryWorkflow } from "./refresh-conversation-memory"

export type SendDirectSupportMessageInput = {
  actor_id: string
  body: string
  client_message_id?: string
  conversation_id: string
}

export type SendDirectSupportMessageResult = {
  delivery_id?: string | null
  message_id: string
  success: boolean
}

const WORKER_ID = `support-direct-send-${os.hostname()}-${process.pid}`

const sendDirectSupportMessageStep = createStep<
  SendDirectSupportMessageInput,
  SendDirectSupportMessageResult,
  undefined
>(
  "send-direct-support-message",
  async (input: SendDirectSupportMessageInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    const conversation = await service.retrieveAgentConversation(
      input.conversation_id
    )

    if (conversation.status !== "OPEN") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Conversation ${conversation.id} is closed.`
      )
    }

    const messageText = input.body.trim()
    if (messageText.length < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Message body cannot be empty."
      )
    }

    const clientMsgId = input.client_message_id ?? crypto.randomUUID()
    const idempotencyKey = `direct-staff-msg:${conversation.id}:${clientMsgId}`

    const existingMessage = (
      await service.listAgentMessages(
        { idempotency_key: idempotencyKey },
        { take: 1 }
      )
    )[0]

    if (existingMessage) {
      return new StepResponse<SendDirectSupportMessageResult>({
        message_id: existingMessage.id,
        success: true,
      })
    }

    const now = new Date()
    const metadata = (conversation.metadata ?? {}) as Record<string, unknown>

    const message = await service.createAgentMessages({
      body: messageText,
      channel: conversation.channel,
      conversation_id: conversation.id,
      direction: "OUTBOUND",
      idempotency_key: idempotencyKey,
      message_type: "TEXT",
      occurred_at: now,
      processed_at: now,
      sender_id: input.actor_id,
      sender_type: "user",
      status: "PROCESSED",
      structured_content: {
        direct_staff_reply: true,
        staff_id: input.actor_id,
      },
    })

    await service.updateAgentConversations({
      id: conversation.id,
      last_message_at: now,
    })

    // Resolve open review tasks for this conversation if any
    const openTasks = await service.listAgentTasks(
      {
        conversation_id: conversation.id,
        status: ["TODO", "CLAIMED", "IN_PROGRESS", "WAITING"],
        task_type: "SUPPORT_RESPONSE_REVIEW",
      },
      { take: 5 }
    )

    for (const task of openTasks) {
      try {
        await service.transitionAgentTask({
          assigned_to_id: input.actor_id,
          assigned_to_type: "user",
          expected_status: task.status,
          result: {
            direct_staff_reply: true,
            message_sent: true,
            response_body: messageText,
            reviewed_by_human: true,
          },
          status: "COMPLETED",
          task_id: task.id,
        })
      } catch {
        // Non-blocking task transition
      }
    }

    let deliveryId: string | null = null

    // If external channel (Telegram / Zalo), create delivery and dispatch immediately
    if (
      (conversation.channel === "TELEGRAM" ||
        conversation.channel === "ZALO") &&
      typeof metadata.connection_id === "string"
    ) {
      const connection = await service.retrieveAgentChannelConnection(
        metadata.connection_id
      )
      if (connection.status === "ACTIVE") {
        const delivery = await service.createAgentDeliveries({
          attempt_count: 0,
          available_at: now,
          channel: conversation.channel,
          connection_id: connection.id,
          idempotency_key: `direct-delivery:${message.id}`,
          message_id: message.id,
          status: "PENDING",
        })
        deliveryId = delivery.id

        await locking.execute(
          `dispatch-delivery:${delivery.id}`,
          async () => {
            await dispatchAgentDeliveryWorkflow(container).run({
              input: {
                delivery_id: delivery.id,
                worker_id: WORKER_ID,
              },
            })
          }
        )
      }
    }

    // Refresh conversation memory in the background
    try {
      await refreshConversationMemoryWorkflow(container).run({
        input: { conversation_id: conversation.id },
      })
    } catch {
      // Memory refresh is non-blocking
    }

    return new StepResponse<SendDirectSupportMessageResult>({
      delivery_id: deliveryId,
      message_id: message.id,
      success: true,
    })
  }
)

export const sendDirectSupportMessageWorkflow = createWorkflow(
  "send-direct-support-message",
  function (input: SendDirectSupportMessageInput) {
    const result = sendDirectSupportMessageStep(input)
    return new WorkflowResponse(result)
  }
)
