import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { InventoryLowEventInput } from "../../modules/agent-operations/types"

const processInventoryLowEventStep = createStep(
  "process-inventory-low-event",
  async (input: InventoryLowEventInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.processInventoryLowEvent(input)

    return new StepResponse(result)
  }
)

export const ingestInventoryLowEventWorkflow = createWorkflow(
  "ingest-inventory-low-event",
  function (input: InventoryLowEventInput) {
    const result = processInventoryLowEventStep(input)
    return new WorkflowResponse(result)
  }
)
