import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { configureTenantSkillWorkflow } from "../../../../workflows/agent-operations/configure-tenant-skill"
import { AdminConfigureTenantSkillType } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  res.json(await service.listTenantSkillCatalog("default"))
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureTenantSkillType>,
  res: MedusaResponse
) {
  const { result } = await configureTenantSkillWorkflow(req.scope).run({
    input: { ...req.validatedBody, actor_id: req.auth_context.actor_id },
  })
  res.status(200).json(result)
}
