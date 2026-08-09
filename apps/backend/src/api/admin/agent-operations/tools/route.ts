import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_TOOL_REGISTRY } from "../../../../modules/agent-operations/tool-registry"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({ tools: Object.values(AGENT_TOOL_REGISTRY) })
}
