import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"
import { createAgentTaskWorkflow } from "../../../../workflows/agent-operations/create-agent-task"
import { AdminCreateAgentTaskType } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [tasks, count] = await service.listAndCountAgentTasks({}, {
    order: { created_at: "DESC" },
    take: 100,
  })
  res.json({ count, tasks })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateAgentTaskType>,
  res: MedusaResponse
) {
  const { result } = await createAgentTaskWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      created_by_id: req.auth_context.actor_id,
      created_by_type: "user",
    },
  })
  res.status(result.duplicate ? 200 : 201).json(result)
}
