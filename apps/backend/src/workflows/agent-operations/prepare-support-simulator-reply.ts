import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { RequestAgentActionInput } from "../../modules/agent-operations/types"

export type PrepareSupportSimulatorReplyInput = {
  actor_id: string
  expected_task_updated_at: string
  task_id: string
}

type PrepareSupportSimulatorReplyResult = {
  action_input?: RequestAgentActionInput
  action_request_id?: string
  already_sent: boolean
  send_idempotency_key: string
  task: Awaited<
    ReturnType<AgentOperationsModuleService["retrieveAgentTask"]>
  >
}

const prepareSupportSimulatorReplyStep = createStep<
  PrepareSupportSimulatorReplyInput,
  PrepareSupportSimulatorReplyResult,
  undefined
>(
  "prepare-support-simulator-reply",
  async (input: PrepareSupportSimulatorReplyInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const task = await service.retrieveAgentTask(input.task_id)
    const result = (task.result ?? {}) as Record<string, unknown>
    const sendIdempotencyKey =
      `support-reply-send:${task.id}:${input.expected_task_updated_at}`

    if (result.message_sent === true) {
      if (
        result.send_idempotency_key === sendIdempotencyKey &&
        typeof result.send_action_request_id === "string"
      ) {
        return new StepResponse<PrepareSupportSimulatorReplyResult>({
          action_request_id: result.send_action_request_id,
          already_sent: true,
          send_idempotency_key: sendIdempotencyKey,
          task,
        })
      }
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This response has already been sent."
      )
    }

    if (
      new Date(task.updated_at).toISOString() !==
      new Date(input.expected_task_updated_at).toISOString()
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "The reviewed response changed. Refresh before sending it."
      )
    }
    if (
      task.status !== "COMPLETED" ||
      task.task_type !== "SUPPORT_RESPONSE_REVIEW" ||
      task.assigned_to_type !== "user" ||
      task.assigned_to_id !== input.actor_id ||
      result.reviewed_by_human !== true ||
      typeof result.response_body !== "string" ||
      result.response_body.trim().length < 3 ||
      !task.incident_id
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only the employee who reviewed this response can send it."
      )
    }

    const incident = await service.retrieveAgentIncident(task.incident_id)
    const taskInput = (task.input ?? {}) as Record<string, unknown>
    const conversation =
      typeof taskInput.conversation_id === "string"
        ? await service.retrieveAgentConversation(taskInput.conversation_id)
        : (
            await service.listAgentConversations(
              {
                channel: "IN_APP",
                incident_id: incident.id,
                topic_type: "CUSTOMER_SUPPORT",
              },
              { take: 1 }
            )
          )[0]
    const metadata = (conversation?.metadata ?? {}) as Record<string, unknown>
    const isSimulator =
      conversation?.channel === "IN_APP" && metadata.simulator === true
    const isExternalCustomer =
      conversation?.channel !== "IN_APP" &&
      conversation?.topic_type === "CUSTOMER_SUPPORT_CHAT" &&
      metadata.principal_role === "CUSTOMER"
    if (
      !conversation ||
      conversation.tenant_id !== task.tenant_id ||
      (!isSimulator && !isExternalCustomer)
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This request is not connected to an authorized customer conversation."
      )
    }

    const actionInput: RequestAgentActionInput = {
      correlation_id: incident.correlation_id,
      granted_permissions: ["agent_message:create"],
      granted_roles: [],
      idempotency_key: sendIdempotencyKey,
      incident_id: incident.id,
      input: {
        body: result.response_body.trim(),
        conversation_id: conversation.id,
        message_type: "TEXT",
        structured_content: {
          human_confirmed: true,
          simulator: isSimulator,
          support_task_id: task.id,
        },
      },
      requested_by_id: input.actor_id,
      requested_by_type: "user",
      tenant_id: task.tenant_id,
      tool_name: "message.send",
      tool_version: "1.0.0",
    }

    return new StepResponse<PrepareSupportSimulatorReplyResult>({
      action_input: actionInput,
      already_sent: false,
      send_idempotency_key: sendIdempotencyKey,
      task,
    })
  }
)

export const prepareSupportSimulatorReplyWorkflow = createWorkflow(
  "prepare-support-simulator-reply",
  function (input: PrepareSupportSimulatorReplyInput) {
    return new WorkflowResponse(prepareSupportSimulatorReplyStep(input))
  }
)
