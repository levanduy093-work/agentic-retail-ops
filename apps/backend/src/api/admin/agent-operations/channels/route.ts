import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [channels, count] = await service.listAndCountAgentChannelConnections(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  )
  res.json({ count, channels })
}
