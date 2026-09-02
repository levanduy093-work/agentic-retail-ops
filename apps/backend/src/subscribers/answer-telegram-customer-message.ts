import { createChannelAdapter } from "../modules/agent-operations/channel-gateway";
import os from "node:os";
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations";
import AgentOperationsModuleService from "../modules/agent-operations/service";
import { answerCustomerKnowledgeQuestionWorkflow } from "../workflows/agent-operations/answer-customer-knowledge-question";
import { dispatchAgentDeliveryWorkflow } from "../workflows/agent-operations/dispatch-agent-delivery";
import { refreshConversationMemoryWorkflow } from "../workflows/agent-operations/refresh-conversation-memory";

type TelegramCustomerMessageReceivedData = {
  inbound_message_id: string;
};

const WORKER_ID = `telegram-realtime-${os.hostname()}-${process.pid}`;

export default async function answerTelegramCustomerMessageHandler({
  event: { data },
  container,
}: SubscriberArgs<TelegramCustomerMessageReceivedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const startedAt = Date.now();

  try {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE,
    );
    const inbound = await service.retrieveAgentMessage(data.inbound_message_id);

    let typingInterval: NodeJS.Timeout | undefined;
    try {
      const conversation = await service.retrieveAgentConversation(
        inbound.conversation_id,
      );
      const metadata = (conversation.metadata ?? {}) as Record<string, unknown>;
      if (metadata.connection_id && conversation.external_thread_id) {
        const connection = await service.retrieveAgentChannelConnection(
          metadata.connection_id as string,
        );
        if (
          connection.channel === "TELEGRAM" &&
          connection.status === "ACTIVE"
        ) {
          const botToken = await service.resolveChannelBotToken(connection);
          const adapter = createChannelAdapter("TELEGRAM", {
            telegram: {
              api_base_url: (connection.config as Record<string, unknown>)
                ?.api_base_url as string | undefined,
              bot_token: botToken,
            },
          });
          const signalTyping = async () => {
            try {
              await adapter.signalTyping?.(
                conversation.external_thread_id as string,
              );
            } catch {}
          };
          await signalTyping();
          typingInterval = setInterval(signalTyping, 4000);
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to start typing indicator for ${data.inbound_message_id}: ${error}`,
      );
    }

    let workflowResult;
    try {
      const { result } = await answerCustomerKnowledgeQuestionWorkflow(
        container,
      ).run({
        input: { inbound_message_id: data.inbound_message_id },
      });
      workflowResult = result;
    } finally {
      if (typingInterval) clearInterval(typingInterval);
    }

    if (workflowResult?.delivery_id) {
      await dispatchAgentDeliveryWorkflow(container).run({
        input: {
          delivery_id: workflowResult.delivery_id,
          worker_id: WORKER_ID,
        },
      });
    }
    logger.info(
      `Telegram customer answer delivered in ${Date.now() - startedAt}ms ` +
        `(prepared in ${workflowResult?.response_preparation_ms ?? 0}ms)`,
    );
    await refreshConversationMemoryWorkflow(container).run({
      input: { conversation_id: inbound.conversation_id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      `Realtime Telegram customer answer failed for ${data.inbound_message_id}: ${message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "agent.telegram.customer-message-received",
};
