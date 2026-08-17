import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { syncGhtkFulfillmentStatusWorkflow } from "../../../../../../workflows/shipping-hub/sync-ghtk-fulfillment-status"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await syncGhtkFulfillmentStatusWorkflow(req.scope).run({
    input: { fulfillment_id: req.params.id },
  })

  res.json({ shipment: result })
}
