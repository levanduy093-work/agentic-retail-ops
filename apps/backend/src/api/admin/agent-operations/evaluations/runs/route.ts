import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { runAgentEvaluationWorkflow } from "../../../../../workflows/agent-operations/run-agent-evaluation"
import { AdminRunAgentEvaluationType } from "../../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [runs, count] = await service.listAndCountAgentEvaluationRuns({}, {
    order: { started_at: "DESC" },
    take: 100,
  })
  res.json({ count, runs })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminRunAgentEvaluationType>,
  res: MedusaResponse
) {
  const { result } = await runAgentEvaluationWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.status(result.duplicate ? 200 : 201).json(result)
}
