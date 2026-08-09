import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const incident = await service.retrieveAgentIncident(req.params.id)
  const [
    runs,
    recommendations,
    approvals,
    actions,
    tool_calls,
    audit_events,
    outbox_events,
  ] =
    await Promise.all([
      service.listAgentRuns(
        { incident_id: incident.id },
        { order: { created_at: "ASC" } }
      ),
      service.listAgentRecommendations(
        { incident_id: incident.id },
        { order: { created_at: "ASC" } }
      ),
      service.listAgentApprovals(
        { incident_id: incident.id },
        { order: { created_at: "ASC" } }
      ),
      service.listAgentActionRequests(
        { incident_id: incident.id },
        { order: { created_at: "ASC" } }
      ),
      service.listAgentToolCalls(
        { incident_id: incident.id },
        { order: { started_at: "ASC" } }
      ),
      service.listAgentAuditEvents(
        { incident_id: incident.id },
        { order: { recorded_at: "ASC" } }
      ),
      service.listAgentOutboxEvents(
        { aggregate_id: incident.id, aggregate_type: "agent_incident" },
        { order: { created_at: "ASC" } }
      ),
    ])

  res.json({
    actions,
    approvals,
    audit_events,
    incident,
    outbox_events,
    recommendations,
    runs,
    tool_calls,
  })
}
