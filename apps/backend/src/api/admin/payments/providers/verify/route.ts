import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { TestPaymentProviderType } from "../validators"
import { verifyPayosProviderWorkflow } from "../../../../../workflows/payments/verify-payos-provider"
import { verifySepayProviderWorkflow } from "../../../../../workflows/payments/verify-sepay-provider"

export async function POST(
  req: AuthenticatedMedusaRequest<TestPaymentProviderType>,
  res: MedusaResponse
) {
  const code = (req.validatedBody.code || "SEPAY").toUpperCase()

  if (code === "SEPAY") {
    const { result } = await verifySepayProviderWorkflow(req.scope).run({
      input: req.validatedBody,
    })
    return res.json(result)
  }

  const { result } = await verifyPayosProviderWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.json(result)
}
