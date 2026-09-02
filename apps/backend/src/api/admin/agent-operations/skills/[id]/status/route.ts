import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { setTenantSkillStatusWorkflow } from "../../../../../../workflows/agent-operations/set-tenant-skill-status"
import { AdminSetTenantSkillStatusType } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSetTenantSkillStatusType>,
  res: MedusaResponse
) {
  const { result } = await setTenantSkillStatusWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      skill_id: req.params.id,
      ...req.validatedBody,
    },
  })
  res.status(200).json(result)
}
