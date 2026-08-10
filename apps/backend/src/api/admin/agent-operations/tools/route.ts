import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getAgentToolCoverage,
  listAgentToolMetadata,
} from "../../../../modules/agent-operations/tool-registry"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({
    coverage: getAgentToolCoverage(),
    tools: listAgentToolMetadata(),
  })
}
