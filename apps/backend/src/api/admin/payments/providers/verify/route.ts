import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { TestPayosProviderType } from "../validators"
import { verifyPayosProviderWorkflow } from "../../../../../workflows/payments/verify-payos-provider"

export async function POST(
  req: AuthenticatedMedusaRequest<TestPayosProviderType>,
  res: MedusaResponse
) {
  const { result } = await verifyPayosProviderWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.json(result)
}
