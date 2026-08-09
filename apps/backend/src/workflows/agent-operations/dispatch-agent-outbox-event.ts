import { IEventBusModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import {
  DispatchAgentOutboxEventInput,
  OutboxStatus,
} from "../../modules/agent-operations/types"

const DEFAULT_LEASE_DURATION_MS = 60_000
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_MAX_RETRY_DELAY_MS = 15 * 60_000
const DEFAULT_RETRY_BASE_DELAY_MS = 5_000

const claimAgentOutboxEventStep = createStep(
  "claim-agent-outbox-event",
  async (input: DispatchAgentOutboxEventInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const claimedAt = new Date().toISOString()
    const result = await service.claimAgentOutboxEvent({
      claimed_at: claimedAt,
      event_id: input.event_id,
      lease_duration_ms:
        input.lease_duration_ms ?? DEFAULT_LEASE_DURATION_MS,
      worker_id: input.worker_id,
    })

    return new StepResponse(result, {
      event_id: input.event_id,
      max_attempts: input.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
      max_retry_delay_ms:
        input.max_retry_delay_ms ?? DEFAULT_MAX_RETRY_DELAY_MS,
      retry_base_delay_ms:
        input.retry_base_delay_ms ?? DEFAULT_RETRY_BASE_DELAY_MS,
      worker_id: input.worker_id,
    })
  },
  async (input, { container }) => {
    if (!input) {
      return
    }

    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )

    try {
      await service.markAgentOutboxEventFailed({
        ...input,
        error: "Outbox dispatch workflow was compensated",
        failed_at: new Date().toISOString(),
      })
    } catch {
      // Another worker can recover the event after its lease expires.
    }
  }
)

type DeliverAgentOutboxEventInput = {
  claim: Awaited<
    ReturnType<AgentOperationsModuleService["claimAgentOutboxEvent"]>
  >
  dispatch: DispatchAgentOutboxEventInput
}

type DeliverAgentOutboxEventResult = {
  delivered: boolean
  event_id: string | null
  skipped: boolean
  status: OutboxStatus | null
}

const deliverAgentOutboxEventStep = createStep<
  DeliverAgentOutboxEventInput,
  DeliverAgentOutboxEventResult,
  undefined
>(
  "deliver-agent-outbox-event",
  async (input, { container }) => {
    if (!input.claim.claimed || !input.claim.event) {
      return new StepResponse<DeliverAgentOutboxEventResult>({
        delivered: false,
        event_id: null,
        skipped: true,
        status: null,
      })
    }

    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
    const event = input.claim.event
    const completedAt = new Date().toISOString()

    try {
      const payload =
        event.payload && typeof event.payload === "object"
          ? event.payload
          : { value: event.payload }

      await eventBus.emit({
        data: {
          ...payload,
          agent_outbox: {
            aggregate_id: event.aggregate_id,
            aggregate_type: event.aggregate_type,
            event_id: event.id,
            event_version: event.event_version,
            idempotency_key: event.idempotency_key,
          },
        },
        name: event.event_type,
      })
      const deliveredEvent = await service.markAgentOutboxEventDelivered({
        completed_at: completedAt,
        event_id: event.id,
        worker_id: input.dispatch.worker_id,
      })

      return new StepResponse<DeliverAgentOutboxEventResult>({
        delivered: true,
        event_id: deliveredEvent.id,
        skipped: false,
        status: deliveredEvent.status,
      })
    } catch (error) {
      const failedEvent = await service.markAgentOutboxEventFailed({
        error: error instanceof Error ? error.message : "Unknown error",
        event_id: event.id,
        failed_at: completedAt,
        max_attempts: input.dispatch.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
        max_retry_delay_ms:
          input.dispatch.max_retry_delay_ms ?? DEFAULT_MAX_RETRY_DELAY_MS,
        retry_base_delay_ms:
          input.dispatch.retry_base_delay_ms ?? DEFAULT_RETRY_BASE_DELAY_MS,
        worker_id: input.dispatch.worker_id,
      })

      return new StepResponse<DeliverAgentOutboxEventResult>({
        delivered: false,
        event_id: failedEvent.id,
        skipped: false,
        status: failedEvent.status,
      })
    }
  }
)

export const dispatchAgentOutboxEventWorkflow = createWorkflow(
  "dispatch-agent-outbox-event",
  function (input: DispatchAgentOutboxEventInput) {
    const claim = claimAgentOutboxEventStep(input)
    const result = deliverAgentOutboxEventStep({ claim, dispatch: input })

    return new WorkflowResponse(result)
  }
)
