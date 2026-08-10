import type {
  ILockingModule,
  IOrderModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { assignOrderSlaMetadata } from "../../modules/agent-operations/order-sla-assignment"

export type AssignOrderSlaInput = {
  order_id: string
  source: "order-created-hook" | "order-placed-event"
}

type AssignOrderSlaResult = {
  assigned: boolean
  order_id: string
  source: AssignOrderSlaInput["source"]
}

type AssignOrderSlaCompensation = {
  metadata: Record<string, unknown> | null
  order_id: string
} | null

const assignOrderSlaStep = createStep(
  "assign-order-sla",
  async (input: AssignOrderSlaInput, { container }) => {
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
    const mutation = await locking.execute(
      `agent-order-sla-assignment:${input.order_id}`,
      async () => {
        const order = await orders.retrieveOrder(input.order_id, {
          relations: ["items"],
        })
        const assignment = assignOrderSlaMetadata(order)

        if (!assignment.changed) {
          return {
            compensation: null,
            result: {
              assigned: false,
              order_id: order.id,
              source: input.source,
            } satisfies AssignOrderSlaResult,
          }
        }

        await orders.updateOrders(order.id, {
          metadata: assignment.metadata,
        })

        return {
          compensation: {
            metadata: order.metadata ?? null,
            order_id: order.id,
          } satisfies Exclude<AssignOrderSlaCompensation, null>,
          result: {
            assigned: true,
            order_id: order.id,
            source: input.source,
          } satisfies AssignOrderSlaResult,
        }
      }
    )

    return new StepResponse<AssignOrderSlaResult, AssignOrderSlaCompensation>(
      mutation.result,
      mutation.compensation
    )
  },
  async (input: AssignOrderSlaCompensation, { container }) => {
    if (!input) {
      return
    }

    const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orders.updateOrders(input.order_id, { metadata: input.metadata })
  }
)

export const assignOrderSlaWorkflow = createWorkflow(
  "assign-order-sla",
  function (input: AssignOrderSlaInput) {
    return new WorkflowResponse(assignOrderSlaStep(input))
  }
)
