import { getOrderDetailWorkflow } from "@medusajs/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  FulfillmentReadInput,
  FulfillmentReadOutput,
  toFulfillmentReadOutput,
} from "./tools/fulfillment-tools"

export async function executeFulfillmentRead(
  container: MedusaContainer,
  input: FulfillmentReadInput,
  actorId: string
) {
  return executeAgentTool<FulfillmentReadInput, FulfillmentReadOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: actorId,
        granted_permissions: ["agent_fulfillment:read"],
        mode: "DIRECT",
      },
      input,
      tool_name: "fulfillment.read",
      tool_version: "1.0.0",
    },
    async ({ order_id }) => {
      const { result } = await getOrderDetailWorkflow(container).run({
        input: {
          fields: [
            "id",
            "display_id",
            "fulfillment_status",
            "fulfillments.id",
            "fulfillments.provider_id",
            "fulfillments.data",
            "fulfillments.shipped_at",
            "fulfillments.delivered_at",
            "fulfillments.labels.tracking_number",
            "fulfillments.labels.tracking_url",
            "version",
          ],
          order_id,
        },
      })

      return toFulfillmentReadOutput(result)
    }
  )
}
