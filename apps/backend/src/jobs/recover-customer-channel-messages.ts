import os from "node:os"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import { isCustomerSupportConversation } from "../modules/agent-operations/channel-principal"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import type { ConversationChannel } from "../modules/agent-operations/types"
import { answerCustomerKnowledgeQuestionWorkflow } from "../workflows/agent-operations/answer-customer-knowledge-question"
import { dispatchAgentDeliveryWorkflow } from "../workflows/agent-operations/dispatch-agent-delivery"
import { refreshConversationMemoryWorkflow } from "../workflows/agent-operations/refresh-conversation-memory"

const BATCH_SIZE = 25
const CANDIDATE_WINDOW = 250
const RECOVERABLE_CHANNELS = new Set<ConversationChannel>([
  "TELEGRAM",
  "ZALO",
  "MESSENGER",
  "TIKTOK",
])
const WORKER_ID = `customer-channel-recovery-${os.hostname()}-${process.pid}`

/**
 * Recovers inbound messages that were durably stored by a webhook but whose
 * realtime subscriber did not finish before a restart or transient failure.
 *
 * The answer workflow and delivery dispatcher are both idempotent, so this
 * job can safely run alongside the realtime subscribers and after a restart.
 */
export default async function recoverCustomerChannelMessagesJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const inboundMessages = (
    await Promise.all(
      [...RECOVERABLE_CHANNELS].map((channel) =>
        service.listAgentMessages(
          {
            channel,
            direction: "INBOUND",
            message_type: "TEXT",
            status: "PROCESSED",
          },
          { order: { occurred_at: "ASC" }, take: CANDIDATE_WINDOW }
        )
      )
    )
  )
    .flat()
    .sort(
      (left, right) =>
        new Date(left.occurred_at).getTime() -
        new Date(right.occurred_at).getTime()
    )
  let recovered = 0

  for (const inbound of inboundMessages) {
    if (recovered >= BATCH_SIZE) break
    if (!RECOVERABLE_CHANNELS.has(inbound.channel)) continue

    const existing = await service.listAgentMessages(
      { idempotency_key: `customer-answer:${inbound.id}` },
      { take: 1 }
    )
    if (existing.length) {
      const deliveries = await service.listAgentDeliveries(
        { message_id: existing[0].id },
        { take: 1 }
      )
      if (deliveries.length) continue
    }
    const escalations = await service.listAgentTasks(
      {
        idempotency_key: `customer-knowledge-escalation:${inbound.id}`,
      },
      { take: 1 }
    )
    if (escalations.length) continue

    try {
      const conversation = await service.retrieveAgentConversation(
        inbound.conversation_id
      )
      if (
        !isCustomerSupportConversation({
          metadata: (conversation.metadata ?? {}) as Record<string, unknown>,
          topic_type: conversation.topic_type,
        })
      ) {
        continue
      }

      await refreshConversationMemoryWorkflow(container).run({
        input: { conversation_id: conversation.id },
      })
      const { result } = await answerCustomerKnowledgeQuestionWorkflow(
        container
      ).run({ input: { inbound_message_id: inbound.id } })
      if (result.delivery_id) {
        await dispatchAgentDeliveryWorkflow(container).run({
          input: {
            delivery_id: result.delivery_id,
            worker_id: WORKER_ID,
          },
        })
      }
      await refreshConversationMemoryWorkflow(container).run({
        input: { conversation_id: conversation.id },
      })
      recovered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(
        `Customer channel recovery failed for ${inbound.id}: ${message}`
      )
    }
  }

  if (recovered) {
    logger.info(`Customer channel recovery processed: ${recovered}.`)
  }
}

export const config = {
  name: "recover-customer-channel-messages",
  schedule: "* * * * *",
}
