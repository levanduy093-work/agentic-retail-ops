import {
  AuthenticatedMedusaRequest,
  MedusaResponse
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { linkGoogleCustomerWorkflow } from "../../../../workflows/link-google-customer"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (req.auth_context.auth_provider !== "google-one-tap") {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Google authentication is required to link this account."
    )
  }

  const { result } = await linkGoogleCustomerWorkflow(req.scope).run({
    input: {
      authIdentityId: req.auth_context.auth_identity_id
    }
  })

  res.status(200).json({ linked: result.linked })
}
