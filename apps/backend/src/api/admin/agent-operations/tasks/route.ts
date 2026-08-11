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
  const incidentIds = Array.from(
    new Set(
      tasks
        .map((task) => task.incident_id)
        .filter((incidentId): incidentId is string => Boolean(incidentId))
    )
  )
  const incidents = await Promise.all(
    incidentIds.map((incidentId) =>
      service.retrieveAgentIncident(incidentId)
    )
  )
  const correlationByIncidentId = new Map(
    incidents.map((incident) => [incident.id, incident.correlation_id])
  )
  const conversations = await Promise.all(
    incidentIds.map(async (incidentId) => {
      const conversation = (
        await service.listAgentConversations(
          {
            channel: "IN_APP",
            incident_id: incidentId,
            topic_type: "CUSTOMER_SUPPORT",
          },
          { take: 1 }
        )
      )[0]

      return [incidentId, conversation?.id ?? null] as const
    })
  )
  const conversationByIncidentId = new Map(conversations)

  res.json({
    count,
    tasks: tasks.map((task) => ({
      ...task,
      incident_correlation_id: task.incident_id
        ? correlationByIncidentId.get(task.incident_id) ?? null
        : null,
      support_conversation_id: task.incident_id
        ? conversationByIncidentId.get(task.incident_id) ?? null
        : null,
    })),
  })
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
