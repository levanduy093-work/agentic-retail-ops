import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { executeAgentActionWorkflow } from "../../../../../workflows/agent-operations/execute-agent-action"
import { ingestSupportRequestWorkflow } from "../../../../../workflows/agent-operations/ingest-support-request"
import { recordSupportSimulatorMessageWorkflow } from "../../../../../workflows/agent-operations/record-support-simulator-message"
import { AdminCreateSupportSimulatorMessageType } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateSupportSimulatorMessageType>,
  res: MedusaResponse
) {
  const actorId = req.auth_context.actor_id
  const occurredAt = new Date().toISOString()
  const eventId = `support-simulator:${req.validatedBody.client_message_id}`
  const { result: support } = await ingestSupportRequestWorkflow(req.scope).run(
    {
      input: {
        correlation_id: eventId,
        event_id: eventId,
        event_type: "support.requested",
        event_version: 1,
        occurred_at: occurredAt,
        payload: {
          customer_id: req.validatedBody.customer_id,
          locale: req.validatedBody.locale,
          order_id: req.validatedBody.order_id,
          question: req.validatedBody.question,
          request_type: "ORDER_STATUS",
          requested_at: occurredAt,
        },
        source: "support-simulator",
        subject_id: req.validatedBody.order_id,
        subject_type: "order",
        tenant_id: "default",
      },
    }
  )

  if (!support.incident || !support.action_request) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The support request did not create an incident and review action."
    )
  }

  const { result: chat } = await recordSupportSimulatorMessageWorkflow(
    req.scope
  ).run({
    input: {
      actor_id: actorId,
      client_message_id: req.validatedBody.client_message_id,
      customer_id: req.validatedBody.customer_id,
      incident_id: support.incident.id,
      locale: req.validatedBody.locale,
      occurred_at: occurredAt,
      order_id: req.validatedBody.order_id,
      question: req.validatedBody.question,
    },
  })
  const { result: execution } = await executeAgentActionWorkflow(req.scope).run(
    {
      input: {
        action_request_id: support.action_request.id,
        actor_id: actorId,
        actor_type: "user",
        worker_id: `support-simulator-${actorId}`,
      },
    }
  )

  res.status(support.duplicate && chat.duplicate ? 200 : 201).json({
    action: execution.action,
    conversation: chat.conversation,
    duplicate: support.duplicate && chat.duplicate,
    incident: support.incident,
    message: chat.message,
  })
}
