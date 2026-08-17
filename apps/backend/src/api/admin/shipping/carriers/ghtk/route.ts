import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { configureGhtkCarrierWorkflow } from "../../../../../workflows/shipping-hub/configure-ghtk-carrier"
import type { ConfigureGhtkCarrier } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<ConfigureGhtkCarrier>,
  res: MedusaResponse
) {
  const { result } = await configureGhtkCarrierWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.json({ carrier: result })
}
