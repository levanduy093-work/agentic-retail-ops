import { createOrderWorkflow } from "@medusajs/core-flows"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { assignOrderSlaMetadata } from "../../modules/agent-operations/order-sla-assignment"

type CompensationInput = {
  metadata: Record<string, unknown> | null
  order_id: string
}

createOrderWorkflow.hooks.orderCreated(
  async ({ order }, { container }) => {
    if (process.env.ORDER_SLA_ASSIGNMENT_ENABLED === "false") {
      return
    }

    const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
    const persistedOrder = await orders.retrieveOrder(order.id, {
      relations: ["items"],
    })
    const assignment = assignOrderSlaMetadata(persistedOrder)
    if (!assignment.changed) {
      return
    }

    await orders.updateOrders(order.id, { metadata: assignment.metadata })

    return new StepResponse(
      {
        assigned: true,
        order_id: order.id,
      },
      {
        metadata: persistedOrder.metadata ?? null,
        order_id: order.id,
      } satisfies CompensationInput
    )
  },
  async (input: CompensationInput | undefined, { container }) => {
    if (!input) {
      return
    }

    const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orders.updateOrders(input.order_id, { metadata: input.metadata })
  }
)
