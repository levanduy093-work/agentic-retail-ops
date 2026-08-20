import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { testMessengerConnectionWorkflow } from "../../../../../../workflows/agent-operations/test-messenger-connection"
import { AdminTestMessengerConnectionType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminTestMessengerConnectionType>,
  res: MedusaResponse
) {
  const { result } = await testMessengerConnectionWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.status(200).json(result)
}
