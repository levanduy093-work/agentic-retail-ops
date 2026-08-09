import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  AGENT_FOUNDATIONS,
  getAgentCatalogReadiness,
} from "../../../../modules/agent-operations/catalog-registry"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({
    agents: getAgentCatalogReadiness(),
    count: getAgentCatalogReadiness().length,
    foundations: AGENT_FOUNDATIONS,
  })
}
