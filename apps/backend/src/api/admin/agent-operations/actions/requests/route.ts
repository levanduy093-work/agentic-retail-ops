import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getAgentToolDefinition } from "../../../../../modules/agent-operations/tool-registry"
import { requestAgentActionWorkflow } from "../../../../../workflows/agent-operations/request-agent-action"
import { AdminRequestAgentActionType } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminRequestAgentActionType>,
  res: MedusaResponse
) {
  const definition = getAgentToolDefinition(req.validatedBody.tool_name)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: users } = await query.graph(
    {
      entity: "user",
      fields: ["id", "rbac_roles.name"],
      filters: { id: req.auth_context.actor_id },
    },
    { throwIfKeyNotFound: true }
  )
  const grantedRoles = (
    users[0] as { rbac_roles?: Array<{ name: string }> }
  ).rbac_roles?.map((role) => role.name) ?? []

  const { result } = await requestAgentActionWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      granted_permissions: definition ? [definition.permission] : [],
      granted_roles: grantedRoles,
      requested_by_id: req.auth_context.actor_id,
      requested_by_type: "user",
    },
  })

  res.status(result.duplicate ? 200 : 202).json(result)
}
