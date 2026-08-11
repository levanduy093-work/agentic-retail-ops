import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const document = await service.retrieveAgentKnowledgeDocument(req.params.id)
  const chunks = await service.listAgentKnowledgeChunks(
    { document_id: document.id },
    { order: { chunk_index: "ASC" } }
  )
  res.json({ chunks, document })
}
