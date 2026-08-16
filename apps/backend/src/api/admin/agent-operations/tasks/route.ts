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
    AGENT_OPERATIONS_MODULE,
  )
  const [tasks, count] = await service.listAndCountAgentTasks(
    {},
    {
      order: { created_at: "DESC" },
      take: 100,
    },
  )
  const incidentIds = Array.from(
    new Set(
      tasks
        .map((task) => task.incident_id)
        .filter((incidentId): incidentId is string => Boolean(incidentId)),
    ),
  )
  const incidents = incidentIds.length
    ? await service.listAgentIncidents(
        { id: incidentIds },
        { take: incidentIds.length },
      )
    : []
  const correlationByIncidentId = new Map(
    incidents.map((incident) => [incident.id, incident.correlation_id]),
  )
  const incidentConversations = incidentIds.length
    ? await service.listAgentConversations(
        { incident_id: incidentIds },
        { order: { last_message_at: "DESC" }, take: incidentIds.length * 5 },
      )
    : []
  const conversationByIncidentId = new Map<
    string,
    (typeof incidentConversations)[0]
  >()
  for (const conv of incidentConversations) {
    if (
      conv.incident_id &&
      !conversationByIncidentId.has(conv.incident_id) &&
      ["CUSTOMER_SUPPORT", "CUSTOMER_SUPPORT_CHAT"].includes(conv.topic_type)
    ) {
      conversationByIncidentId.set(conv.incident_id, conv)
    }
  }

  const conversationIds = Array.from(
    new Set(
      tasks
        .map((task) => {
          const input = (task.input ?? {}) as Record<string, unknown>
          return typeof input.conversation_id === "string"
            ? input.conversation_id
            : (task.conversation_id ?? null)
        })
        .filter((conversationId): conversationId is string =>
          Boolean(conversationId),
        ),
    ),
  )
  const directConversations = conversationIds.length
    ? await service.listAgentConversations(
        { id: conversationIds },
        { take: conversationIds.length },
      )
    : []
  const conversationsById = new Map(
    directConversations.map((conv) => [conv.id, conv] as const),
  )

  res.json({
    count,
    tasks: tasks.map((task) => {
      const taskInput = (task.input ?? {}) as Record<string, unknown>
      const directConversationId =
        (typeof taskInput.conversation_id === "string"
          ? taskInput.conversation_id
          : null) ?? task.conversation_id
      const conversation = directConversationId
        ? (conversationsById.get(directConversationId) ?? null)
        : task.incident_id
          ? (conversationByIncidentId.get(task.incident_id) ?? null)
          : null
      return {
        ...task,
        incident_correlation_id: task.incident_id
          ? (correlationByIncidentId.get(task.incident_id) ?? null)
          : null,
        support_conversation_channel:
          conversation?.channel ??
          (typeof taskInput.channel === "string" ? taskInput.channel : null),
        support_conversation_id:
          conversation?.id ?? task.conversation_id ?? directConversationId ?? null,
        support_conversation_title: conversation?.title ?? null,
      }
    }),
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateAgentTaskType>,
  res: MedusaResponse,
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
