import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { isCustomerSupportTaskOverdue } from "../../modules/agent-operations/customer-support-sla"

type EscalateOverdueCustomerSupportTaskInput = {
  task_id: string
}

const escalateOverdueCustomerSupportTaskStep = createStep(
  "escalate-overdue-customer-support-task",
  async (input: EscalateOverdueCustomerSupportTaskInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const task = await service.retrieveAgentTask(input.task_id)
    if (
      !isCustomerSupportTaskOverdue({
        due_at: task.due_at,
        escalated_at: task.escalated_at,
        now: new Date(),
        status: task.status,
        task_type: task.task_type,
      })
    ) {
      return new StepResponse({ escalated: false, task })
    }

    const escalation = await service.escalateGovernedAgentTask({
      actor_id: "customer-support-sla-watchdog",
      assigned_to_id: "customer-support-on-call",
      assigned_to_type: "team",
      expected_status: task.status,
      priority: "CRITICAL",
      reason: "Customer support SLA breached. Immediate human takeover required.",
      task_id: task.id,
    })
    if (escalation.outcome !== "SUCCEEDED") {
      return new StepResponse({ escalated: false, task: escalation.task })
    }

    if (escalation.task.conversation_id) {
      const conversation = await service.retrieveAgentConversation(
        escalation.task.conversation_id
      )
      await service.updateAgentConversations({
        id: conversation.id,
        metadata: {
          ...((conversation.metadata ?? {}) as Record<string, unknown>),
          ai_pause_reason: "SUPPORT_SLA_BREACH",
          ai_paused: true,
          human_takeover_at: new Date().toISOString(),
        },
      })
    }

    return new StepResponse({ escalated: true, task: escalation.task })
  }
)

export const escalateOverdueCustomerSupportTaskWorkflow = createWorkflow(
  "escalate-overdue-customer-support-task",
  function (input: EscalateOverdueCustomerSupportTaskInput) {
    return new WorkflowResponse(escalateOverdueCustomerSupportTaskStep(input))
  }
)
