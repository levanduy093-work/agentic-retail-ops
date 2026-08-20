import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { createChannelAdapter } from "../../modules/agent-operations/channel-gateway"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { resolveSecretReference } from "../../modules/agent-operations/secret-reference"
import {
  DeliveryStatus,
  DispatchAgentDeliveryInput,
} from "../../modules/agent-operations/types"

const DEFAULT_LEASE_DURATION_MS = 60_000
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_MAX_RETRY_DELAY_MS = 15 * 60_000
const DEFAULT_RETRY_BASE_DELAY_MS = 5_000

const claimAgentDeliveryStep = createStep(
  "claim-agent-delivery",
  async (input: DispatchAgentDeliveryInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.claimAgentDelivery({
      claimed_at: new Date().toISOString(),
      delivery_id: input.delivery_id,
      lease_duration_ms: input.lease_duration_ms ?? DEFAULT_LEASE_DURATION_MS,
      worker_id: input.worker_id,
    })

    return new StepResponse(result)
  }
)

type DeliverAgentMessageInput = {
  claim: Awaited<
    ReturnType<AgentOperationsModuleService["claimAgentDelivery"]>
  >
  dispatch: DispatchAgentDeliveryInput
}

type DeliverAgentMessageResult = {
  delivered: boolean
  delivery_id: string | null
  skipped: boolean
  status: DeliveryStatus | null
}

const deliverAgentMessageStep = createStep<
  DeliverAgentMessageInput,
  DeliverAgentMessageResult,
  undefined
>("deliver-agent-message", async (input, { container }) => {
  if (!input.claim.claimed || !input.claim.delivery) {
    return new StepResponse<DeliverAgentMessageResult>({
      delivered: false,
      delivery_id: null,
      skipped: true,
      status: null,
    })
  }

  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const delivery = input.claim.delivery
  const completedAt = new Date().toISOString()

  try {
    const [message, connection] = await Promise.all([
      service.retrieveAgentMessage(delivery.message_id),
      service.retrieveAgentChannelConnection(delivery.connection_id),
    ])
    const conversation = await service.retrieveAgentConversation(
      message.conversation_id
    )
    if (
      connection.status !== "ACTIVE" ||
      connection.channel !== delivery.channel ||
      conversation.channel !== delivery.channel ||
      !conversation.external_thread_id
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "The channel connection is unavailable or mismatched."
      )
    }

    const adapter = createChannelAdapter(delivery.channel, {
      messenger:
        delivery.channel === "MESSENGER"
          ? {
              api_base_url:
                typeof (connection.config as Record<string, unknown>)
                  .api_base_url === "string"
                  ? String(
                      (connection.config as Record<string, unknown>).api_base_url
                    )
                  : undefined,
              page_access_token: await service.resolveChannelBotToken(connection),
            }
          : undefined,
      telegram:
        delivery.channel === "TELEGRAM"
          ? {
              api_base_url:
                typeof (connection.config as Record<string, unknown>)
                  .api_base_url === "string"
                  ? String(
                      (connection.config as Record<string, unknown>).api_base_url
                    )
                  : undefined,
              bot_token: await service.resolveChannelBotToken(connection),
            }
          : undefined,
      zalo:
        delivery.channel === "ZALO"
          ? {
              access_token: await service.resolveChannelBotToken(connection),
              api_base_url:
                typeof (connection.config as Record<string, unknown>)
                  .api_base_url === "string"
                  ? String(
                      (connection.config as Record<string, unknown>).api_base_url
                    )
                  : undefined,
            }
          : undefined,
    })
    await adapter.signalTyping?.(conversation.external_thread_id)
    const receipt = await adapter.deliver({
      body: message.body,
      idempotency_key: delivery.idempotency_key,
      message_id: message.id,
      recipient_ref: conversation.external_thread_id,
      structured_content: message.structured_content as
        | Record<string, unknown>
        | undefined,
    })
    const completed = await service.markAgentDeliveryDelivered({
      completed_at: completedAt,
      delivery_id: delivery.id,
      external_message_id: receipt.external_message_id,
      worker_id: input.dispatch.worker_id,
    })

    return new StepResponse<DeliverAgentMessageResult>({
      delivered: true,
      delivery_id: completed.id,
      skipped: false,
      status: completed.status,
    })
  } catch (error) {
    const failed = await service.markAgentDeliveryFailed({
      delivery_id: delivery.id,
      error: error instanceof Error ? error.message : "Unknown delivery error",
      failed_at: completedAt,
      max_attempts: input.dispatch.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
      max_retry_delay_ms:
        input.dispatch.max_retry_delay_ms ?? DEFAULT_MAX_RETRY_DELAY_MS,
      retry_base_delay_ms:
        input.dispatch.retry_base_delay_ms ?? DEFAULT_RETRY_BASE_DELAY_MS,
      worker_id: input.dispatch.worker_id,
    })

    return new StepResponse<DeliverAgentMessageResult>({
      delivered: false,
      delivery_id: failed.id,
      skipped: false,
      status: failed.status,
    })
  }
})

export const dispatchAgentDeliveryWorkflow = createWorkflow(
  "dispatch-agent-delivery",
  function (input: DispatchAgentDeliveryInput) {
    const claim = claimAgentDeliveryStep(input)
    const result = deliverAgentMessageStep({ claim, dispatch: input })

    return new WorkflowResponse(result)
  }
)
