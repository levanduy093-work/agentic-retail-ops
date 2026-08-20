import { getOrderDetailWorkflow } from "@medusajs/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  PaymentReadInput,
  PaymentReadOutput,
  toPaymentReadOutput,
} from "./tools/payment-tools"

export async function executePaymentRead(
  container: MedusaContainer,
  input: PaymentReadInput,
  actorId: string
) {
  return executeAgentTool<PaymentReadInput, PaymentReadOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: actorId,
        granted_permissions: ["agent_payment:read"],
        mode: "DIRECT",
      },
      input,
      tool_name: "payment.read",
      tool_version: "1.0.0",
    },
    async ({ order_id }) => {
      const { result } = await getOrderDetailWorkflow(container).run({
        input: {
          fields: [
            "id",
            "currency_code",
            "display_id",
            "payment_status",
            "payment_collections.id",
            "total",
            "updated_at",
            "version",
          ],
          order_id,
        },
      })

      return toPaymentReadOutput(result)
    }
  )
}
