import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { testZaloConnectionWorkflow } from "../../../../../../workflows/agent-operations/test-zalo-connection"
import { AdminTestZaloOaType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminTestZaloOaType>,
  res: MedusaResponse
) {
  const { result } = await testZaloConnectionWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.status(200).json(result)
}
