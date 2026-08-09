import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { INCIDENT_STATUSES } from "../../../../modules/agent-operations/types"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const rawLimit = Number(req.query.limit ?? 20)
  const rawOffset = Number(req.query.offset ?? 0)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 20
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0
  const status = typeof req.query.status === "string" ? req.query.status : null
  const filters =
    status && INCIDENT_STATUSES.includes(status as never) ? { status } : {}
  const [incidents, count] = await service.listAndCountAgentIncidents(filters, {
    order: { created_at: "DESC" },
    skip: offset,
    take: limit,
  })

  res.json({ count, incidents, limit, offset })
}
