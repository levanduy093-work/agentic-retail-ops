import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { CreateApprovalRequestedNotificationInput } from "../../modules/agent-operations/types"

const createApprovalNotificationStep = createStep(
  "create-approval-notification",
  async (input: CreateApprovalRequestedNotificationInput, { container }) => {
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await locking.execute(
      `agent-communication:outbox:${input.outbox_event_id}`,
      async () => service.createApprovalRequestedNotification(input)
    )

    return new StepResponse(result)
  }
)

export const createApprovalNotificationWorkflow = createWorkflow(
  "create-approval-notification",
  function (input: CreateApprovalRequestedNotificationInput) {
    const result = createApprovalNotificationStep(input)
    return new WorkflowResponse(result)
  }
)
