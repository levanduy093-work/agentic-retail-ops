import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { syncGhnFulfillmentStatusWorkflow } from "../../../../../../workflows/shipping-hub/sync-ghn-fulfillment-status"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await syncGhnFulfillmentStatusWorkflow(req.scope).run({
    input: { fulfillment_id: req.params.id },
  })

  res.json({ shipment: result })
}
