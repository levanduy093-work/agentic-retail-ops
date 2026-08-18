import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { generateGhnFulfillmentLabelWorkflow } from "../../../../../../workflows/shipping-hub/generate-ghn-fulfillment-label"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await generateGhnFulfillmentLabelWorkflow(req.scope).run({
    input: { fulfillment_id: req.params.id },
  })

  res.redirect(result.label_url)
}
