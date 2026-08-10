import { getOrderDetailWorkflow } from "@medusajs/core-flows"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { AGENT_TOOL_REGISTRY } from "../../modules/agent-operations/tool-registry"
import { executeAgentTool } from "../../modules/agent-operations/tool-executor"
import {
  OrderReadInput,
  OrderReadOutput,
  toOrderReadOutput,
} from "../../modules/agent-operations/tools/order-tools"
import { OrderExceptionEventInput } from "../../modules/agent-operations/types"

const readLiveOrderStep = createStep(
  "read-live-order",
  async (input: OrderReadInput, { container }) => {
    const execution = await executeAgentTool<OrderReadInput, OrderReadOutput>(
      AGENT_TOOL_REGISTRY,
      {
        authority: {
          actor_id: "order-exception-agent",
          granted_permissions: ["agent_order:read"],
          mode: "DIRECT",
        },
        input,
        tool_name: "order.read",
        tool_version: "1.0.0",
      },
      async ({ order_id }) => {
        const { result } = await getOrderDetailWorkflow(container).run({
          input: {
            fields: [
              "id",
              "canceled_at",
              "created_at",
              "currency_code",
              "display_id",
              "items.quantity",
              "status",
              "total",
              "updated_at",
              "version",
            ],
            order_id,
          },
        })

        return toOrderReadOutput(result)
      }
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
