import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { testTikTokConnectionWorkflow } from "../../../../../../workflows/agent-operations/test-tiktok-connection"
import { AdminTestTikTokConnectionType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminTestTikTokConnectionType>,
  res: MedusaResponse
) {
  const { result } = await testTikTokConnectionWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.status(200).json(result)
}
