import os from "node:os"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { isCustomerSupportConversation } from "../modules/agent-operations/channel-principal"
import { answerCustomerKnowledgeQuestionWorkflow } from "../workflows/agent-operations/answer-customer-knowledge-question"
import { dispatchAgentDeliveryWorkflow } from "../workflows/agent-operations/dispatch-agent-delivery"
import { refreshConversationMemoryWorkflow } from "../workflows/agent-operations/refresh-conversation-memory"

const BATCH_SIZE = 25
const CANDIDATE_WINDOW = 200
const WORKER_ID = `telegram-knowledge-${os.hostname()}-${process.pid}`

export default async function answerTelegramKnowledgeQuestionsJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const inboundMessages = await service.listAgentMessages(
    {
      channel: "TELEGRAM",
      direction: "INBOUND",
      message_type: "TEXT",
      status: "PROCESSED",
    },
    { order: { occurred_at: "DESC" }, take: CANDIDATE_WINDOW }
  )
  let processed = 0

  for (const inbound of inboundMessages) {
    if (processed >= BATCH_SIZE) break
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
      await refreshConversationMemoryWorkflow(container).run({
        input: { conversation_id: inbound.conversation_id },
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
        input: { conversation_id: inbound.conversation_id },
      })
      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(
        `Telegram knowledge answer failed for ${inbound.id}: ${message}`
      )
    }
  }

  if (processed) {
    logger.info(`Telegram knowledge answers processed: ${processed}.`)
  }
}

export const config = {
  name: "answer-telegram-knowledge-questions",
  schedule: "* * * * *",
}
