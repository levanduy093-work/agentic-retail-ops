import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { testTelegramConnectionWorkflow } from "../../../../../../workflows/agent-operations/test-telegram-connection"
import { AdminTestTelegramBotType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminTestTelegramBotType>,
  res: MedusaResponse
) {
  const { result } = await testTelegramConnectionWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.status(200).json(result)
}
