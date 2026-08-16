import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { resetManagedPromptWorkflow } from "../../../../../../workflows/agent-operations/reset-managed-prompt"
import { AdminResetManagedPromptType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminResetManagedPromptType>,
  res: MedusaResponse
) {
  const { result } = await resetManagedPromptWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      prompt_key: req.validatedBody.prompt_key ?? "all",
    },
  })
  res.status(200).json(result)
}
