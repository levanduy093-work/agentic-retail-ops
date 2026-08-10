import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import { executeOrderRead } from "../../modules/agent-operations/order-read-runtime"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import {
  OrderReadInput,
  OrderReadOutput,
} from "../../modules/agent-operations/tools/order-tools"
import { OrderExceptionEventInput } from "../../modules/agent-operations/types"

const readLiveOrderStep = createStep(
  "read-live-order",
  async (input: OrderReadInput, { container }) => {
    const execution = await executeOrderRead(
      container,
      input,
      "order-exception-agent"
    )

    return new StepResponse(execution.output)
  }
)

const processOrderExceptionEventStep = createStep(
  "process-order-exception-event",
  async (
    input: { event: OrderExceptionEventInput; live_order: OrderReadOutput },
    { container }
  ) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.processOrderExceptionEvent(
      input.event,
      input.live_order
    )

    return new StepResponse(result)
  }
)

export const ingestOrderExceptionEventWorkflow = createWorkflow(
  "ingest-order-exception-event",
  function (input: OrderExceptionEventInput) {
    const liveOrder = readLiveOrderStep({ order_id: input.payload.order_id })
    const result = processOrderExceptionEventStep({
      event: input,
      live_order: liveOrder,
    })

    return new WorkflowResponse(result)
  }
)
