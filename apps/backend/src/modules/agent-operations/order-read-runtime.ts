import { getOrderDetailWorkflow } from "@medusajs/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  OrderReadInput,
  OrderReadOutput,
  toOrderReadOutput,
} from "./tools/order-tools"

export async function executeOrderRead(
  container: MedusaContainer,
  input: OrderReadInput,
  actorId: string
) {
  return executeAgentTool<OrderReadInput, OrderReadOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: actorId,
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
            "customer_id",
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
}
