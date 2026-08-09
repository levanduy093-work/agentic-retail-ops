import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const action = await service.retrieveAgentActionRequest(req.params.id)
  const toolCalls = await service.listAgentToolCalls(
    { action_request_id: action.id },
    { order: { started_at: "ASC" } }
  )

  res.json({ action, tool_calls: toolCalls })
}
