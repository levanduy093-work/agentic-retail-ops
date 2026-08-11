import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { executeAgentActionWorkflow } from "../../../../../../workflows/agent-operations/execute-agent-action"
import { markSupportSimulatorReplySentWorkflow } from "../../../../../../workflows/agent-operations/mark-support-simulator-reply-sent"
import { prepareSupportSimulatorReplyWorkflow } from "../../../../../../workflows/agent-operations/prepare-support-simulator-reply"
import { requestAgentActionWorkflow } from "../../../../../../workflows/agent-operations/request-agent-action"
import { AdminSendSupportSimulatorReplyType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSendSupportSimulatorReplyType>,
  res: MedusaResponse
) {
  const actorId = req.auth_context.actor_id
  const { result: prepared } = await prepareSupportSimulatorReplyWorkflow(
    req.scope
  ).run({
    input: {
      actor_id: actorId,
      expected_task_updated_at: req.validatedBody.expected_task_updated_at,
      task_id: req.params.id,
    },
  })

  if (prepared.already_sent) {
    return res.status(200).json({
      duplicate: true,
      sent: true,
      task: prepared.task,
    })
  }
  if (!prepared.action_input) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The reviewed response did not produce a governed send action."
    )
  }

  const { result: requested } = await requestAgentActionWorkflow(req.scope).run(
    { input: prepared.action_input }
  )
  const { result: execution } = await executeAgentActionWorkflow(req.scope).run(
    {
      input: {
        action_request_id: requested.action.id,
        actor_id: actorId,
        actor_type: "user",
        worker_id: `support-reply-${actorId}`,
      },
    }
  )
  const { result: marked } = await markSupportSimulatorReplySentWorkflow(
    req.scope
  ).run({
    input: {
      action_request_id: execution.action.id,
      actor_id: actorId,
      send_idempotency_key: prepared.send_idempotency_key,
      task_id: req.params.id,
    },
  })

  return res.status(requested.duplicate ? 200 : 201).json({
    action: execution.action,
    duplicate: requested.duplicate || marked.duplicate,
    sent: true,
    task: marked.task,
  })
}
