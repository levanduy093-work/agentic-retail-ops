import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type RecordSupportSimulatorMessageInput = {
  actor_id: string
  client_message_id: string
  customer_id: string
  incident_id: string
  locale: "en" | "vi"
  occurred_at: string
  order_id: string
  question: string
}

const recordSupportSimulatorMessageStep = createStep(
  "record-support-simulator-message",
  async (input: RecordSupportSimulatorMessageInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const idempotencyKey = `support-simulator:${input.client_message_id}`
    const existingMessage = (
      await service.listAgentMessages(
        { idempotency_key: idempotencyKey },
        { take: 1 }
      )
    )[0]

    if (existingMessage) {
      return new StepResponse({
        conversation: await service.retrieveAgentConversation(
          existingMessage.conversation_id
        ),
        duplicate: true,
        message: existingMessage,
      })
    }

    const incident = await service.retrieveAgentIncident(input.incident_id)
    const context = (incident.context ?? {}) as Record<string, unknown>
    if (
      incident.incident_type !== "CUSTOMER_SUPPORT" ||
      context.customer_id !== input.customer_id ||
      incident.subject_id !== input.order_id
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "The simulator message does not match the support incident."
      )
    }

    const now = new Date(input.occurred_at)
    const existingConversation = (
      await service.listAgentConversations(
        {
          channel: "IN_APP",
          topic_id: incident.id,
          topic_type: "CUSTOMER_SUPPORT",
        },
        { take: 1 }
      )
    )[0]
    const conversation =
      existingConversation ??
      (await service.createAgentConversations({
        channel: "IN_APP",
        incident_id: incident.id,
        last_message_at: now,
        metadata: {
          consent: "IN_APP_TEST_ONLY",
          customer_id: input.customer_id,
          locale: input.locale,
          order_id: input.order_id,
          simulator: true,
        },
        opened_at: now,
        status: "OPEN",
        tenant_id: incident.tenant_id,
        title: `Support chat for ${incident.title}`,
        topic_id: incident.id,
        topic_type: "CUSTOMER_SUPPORT",
      }))
    const message = await service.createAgentMessages({
      body: input.question,
      channel: "IN_APP",
      conversation_id: conversation.id,
      direction: "INBOUND",
      idempotency_key: idempotencyKey,
      message_type: "TEXT",
      occurred_at: now,
      processed_at: now,
      sender_id: input.customer_id,
      sender_type: "customer",
      status: "PROCESSED",
      structured_content: {
        client_message_id: input.client_message_id,
        locale: input.locale,
        order_id: input.order_id,
        simulator: true,
      },
    })

    await service.updateAgentConversations({
      id: conversation.id,
      incident_id: incident.id,
      last_message_at: now,
    })
    await service.createAgentAuditEvents({
      action: "support-simulator-message-received",
      actor_id: input.actor_id,
      actor_type: "user",
      correlation_id: incident.correlation_id,
      data: {
        channel: "IN_APP",
        client_message_id: input.client_message_id,
        customer_id: input.customer_id,
        message_id: message.id,
        simulator: true,
      },
      event_type: "agent.communication.message.received",
      incident_id: incident.id,
      recorded_at: now,
      resource_id: message.id,
      resource_type: "agent_message",
    })

    return new StepResponse({ conversation, duplicate: false, message })
  }
)

export const recordSupportSimulatorMessageWorkflow = createWorkflow(
  "record-support-simulator-message",
  function (input: RecordSupportSimulatorMessageInput) {
    return new WorkflowResponse(recordSupportSimulatorMessageStep(input))
  }
)
