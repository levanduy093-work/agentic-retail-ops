import os from "node:os"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { answerCustomerKnowledgeQuestionWorkflow } from "../workflows/agent-operations/answer-customer-knowledge-question"
import { dispatchAgentDeliveryWorkflow } from "../workflows/agent-operations/dispatch-agent-delivery"
import { refreshConversationMemoryWorkflow } from "../workflows/agent-operations/refresh-conversation-memory"

type MessengerCustomerMessageReceivedData = {
  inbound_message_id: string
}

const WORKER_ID = `messenger-realtime-${os.hostname()}-${process.pid}`

export default async function answerMessengerCustomerMessageHandler({
  event: { data },
  container,
}: SubscriberArgs<MessengerCustomerMessageReceivedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const startedAt = Date.now()

  try {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const inbound = await service.retrieveAgentMessage(
      data.inbound_message_id
    )
    const { result } = await answerCustomerKnowledgeQuestionWorkflow(
      container
    ).run({
      input: { inbound_message_id: data.inbound_message_id },
    })
    if (result.delivery_id) {
      await dispatchAgentDeliveryWorkflow(container).run({
        input: {
          delivery_id: result.delivery_id,
          worker_id: WORKER_ID,
        },
      })
    }
    logger.info(
      `Messenger customer answer delivered in ${Date.now() - startedAt}ms ` +
        `(prepared in ${result.response_preparation_ms}ms)`
    )
    await refreshConversationMemoryWorkflow(container).run({
      input: { conversation_id: inbound.conversation_id },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(
      `Realtime Messenger customer answer failed for ${data.inbound_message_id}: ${message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "agent.messenger.customer-message-received",
}
