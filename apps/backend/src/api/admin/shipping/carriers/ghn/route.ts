import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { configureGhnCarrierWorkflow } from "../../../../../workflows/shipping-hub/configure-ghn-carrier"
import type { ConfigureGhnCarrier } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<ConfigureGhnCarrier>,
  res: MedusaResponse
) {
  const { result } = await configureGhnCarrierWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.json({ carrier: result })
}
