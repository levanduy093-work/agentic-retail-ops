import { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type MarkSupportSimulatorReplySentInput = {
  action_request_id: string
  actor_id: string
  send_idempotency_key: string
  task_id: string
}

const markSupportSimulatorReplySentStep = createStep(
  "mark-support-simulator-reply-sent",
  async (input: MarkSupportSimulatorReplySentInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    const result = await locking.execute(
      `agent-task:${input.task_id}`,
      async () => {
        const task = await service.retrieveAgentTask(input.task_id)
        const result = (task.result ?? {}) as Record<string, unknown>
        if (
          result.message_sent === true &&
          result.send_idempotency_key === input.send_idempotency_key
        ) {
          return { duplicate: true, task }
        }

        const action = await service.retrieveAgentActionRequest(
          input.action_request_id
        )
        const actionResult = (action.result ?? {}) as Record<string, unknown>
        if (
          action.status !== "SUCCEEDED" ||
          action.tool_name !== "message.send" ||
          action.idempotency_key !== input.send_idempotency_key ||
          action.requested_by_id !== input.actor_id ||
          action.incident_id !== task.incident_id ||
          actionResult.outcome !== "SUCCEEDED" ||
          typeof actionResult.message_id !== "string" ||
          task.status !== "COMPLETED" ||
          task.assigned_to_id !== input.actor_id
        ) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            "The outbound message could not be verified for this reviewed task."
          )
        }

        const message = await service.retrieveAgentMessage(
          actionResult.message_id
        )
        const conversation = await service.retrieveAgentConversation(
          message.conversation_id
        )
        const actionInput = action.input as Record<string, unknown>
        if (
          message.conversation_id !== actionInput.conversation_id ||
          message.direction !== "OUTBOUND"
        ) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            "The outbound message does not match the support conversation."
          )
        }

        const sentAt = new Date()
        const updatedTask = await service.updateAgentTasks({
          id: task.id,
          result: {
            ...result,
            message_id: message.id,
            message_sent: true,
            send_action_request_id: action.id,
            send_idempotency_key: input.send_idempotency_key,
            sent_at: sentAt.toISOString(),
            sent_by_id: input.actor_id
          }
        })
        await service.createAgentAuditEvents({
          action: "reviewed-support-reply-sent",
          actor_id: input.actor_id,
          actor_type: "user",
          correlation_id: action.correlation_id,
          data: {
            action_request_id: action.id,
            conversation_id: message.conversation_id,
            channel: conversation.channel,
            human_confirmed: true,
            message_id: message.id,
            simulator: conversation.channel === "IN_APP",
            task_id: task.id
          },
          event_type: "agent.support-response.sent",
          incident_id: task.incident_id,
          recorded_at: sentAt,
          resource_id: message.id,
          resource_type: "agent_message"
        })

        return { duplicate: false, task: updatedTask }
      }
    )

    return new StepResponse(result)
  }
)

export const markSupportSimulatorReplySentWorkflow = createWorkflow(
  "mark-support-simulator-reply-sent",
  function (input: MarkSupportSimulatorReplySentInput) {
    return new WorkflowResponse(markSupportSimulatorReplySentStep(input))
  }
)
