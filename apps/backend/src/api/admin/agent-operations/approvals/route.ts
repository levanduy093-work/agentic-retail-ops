import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { APPROVAL_STATUSES } from "../../../../modules/agent-operations/types"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const status = typeof req.query.status === "string" ? req.query.status : null
  const filters =
    status && APPROVAL_STATUSES.includes(status as never) ? { status } : {}
  const [approvals, count] = await service.listAndCountAgentApprovals(filters, {
    order: { created_at: "DESC" },
    take: 100,
  })

  res.json({ approvals, count })
}
