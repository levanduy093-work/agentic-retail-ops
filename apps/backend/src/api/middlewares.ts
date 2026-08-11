import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import {
  AdminCreateAgentTask,
  AdminCreateKnowledgeDocument,
  AdminCreateSupportSimulatorMessage,
  AdminDecideAgentApproval,
  AdminIngestInventoryLowEvent,
  AdminIngestOrderExceptionEvent,
  AdminIngestSupportRequest,
  AdminRunAgentEvaluation,
  AdminRequestAgentAction,
  AdminSendAgentConversationMessage,
  AdminSendSupportSimulatorReply,
  AdminTransitionAgentTask,
  TelegramWebhookUpdate,
} from "./admin/agent-operations/validators"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/webhooks/agent-operations/telegram/:id",
      method: "POST",
      middlewares: [validateAndTransformBody(TelegramWebhookUpdate)],
    },
    {
      matcher: "/store/customers/link-google",
      method: "POST",
      middlewares: [
        authenticate("customer", ["bearer"], { allowUnregistered: true }),
      ],
    },
    {
      matcher: "/admin/agent-operations/events",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminIngestInventoryLowEvent)],
      policies: [{ resource: "agent_event", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/order-exceptions",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminIngestOrderExceptionEvent)],
      policies: [{ resource: "agent_event", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/support-requests",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminIngestSupportRequest)],
      policies: [{ resource: "agent_event", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/support-simulator/messages",
      method: "POST",
      middlewares: [
        validateAndTransformBody(AdminCreateSupportSimulatorMessage),
      ],
      policies: [{ resource: "agent_support_simulator", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/incidents",
      method: "GET",
      policies: [{ resource: "agent_incident", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/incidents/:id",
      method: "GET",
      policies: [{ resource: "agent_incident", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/approvals",
      method: "GET",
      policies: [{ resource: "agent_approval", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/approvals/:id/decision",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminDecideAgentApproval)],
      policies: [{ resource: "agent_approval", operation: "approve" }],
    },
    {
      matcher: "/admin/agent-operations/actions",
      method: "GET",
      policies: [{ resource: "agent_action", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/actions/requests",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminRequestAgentAction)],
      policies: [{ resource: "agent_action", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/actions/:id",
      method: "GET",
      policies: [{ resource: "agent_action", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/actions/:id/execute",
      method: "POST",
      policies: [{ resource: "agent_action", operation: "execute" }],
    },
    {
      matcher: "/admin/agent-operations/tools",
      method: "GET",
      policies: [{ resource: "agent_tool", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/conversations",
      method: "GET",
      policies: [{ resource: "agent_conversation", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/conversations/:id",
      method: "GET",
      policies: [{ resource: "agent_conversation", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/conversations/:id/messages",
      method: "POST",
      middlewares: [
        validateAndTransformBody(AdminSendAgentConversationMessage),
      ],
      policies: [{ resource: "agent_message", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/catalog",
      method: "GET",
      policies: [{ resource: "agent_catalog", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/platform/readiness",
      method: "GET",
      policies: [{ resource: "agent_platform", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/platform/bootstrap",
      method: "POST",
      policies: [{ resource: "agent_platform", operation: "configure" }],
    },
    {
      matcher: "/admin/agent-operations/tasks",
      method: "GET",
      policies: [{ resource: "agent_task", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/tasks",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminCreateAgentTask)],
      policies: [{ resource: "agent_task", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/tasks/:id/transition",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminTransitionAgentTask)],
      policies: [{ resource: "agent_task", operation: "update" }],
    },
    {
      matcher: "/admin/agent-operations/tasks/:id/release",
      method: "POST",
      policies: [{ resource: "agent_task", operation: "update" }],
    },
    {
      matcher: "/admin/agent-operations/tasks/:id/send-simulator-reply",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminSendSupportSimulatorReply)],
      policies: [{ resource: "agent_message", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge",
      method: "GET",
      policies: [{ resource: "agent_knowledge", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminCreateKnowledgeDocument)],
      policies: [{ resource: "agent_knowledge", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/:id/approve",
      method: "POST",
      policies: [{ resource: "agent_knowledge", operation: "approve" }],
    },
    {
      matcher: "/admin/agent-operations/evaluations/scenarios",
      method: "GET",
      policies: [{ resource: "agent_evaluation", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/evaluations/runs",
      method: "GET",
      policies: [{ resource: "agent_evaluation", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/evaluations/runs",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminRunAgentEvaluation)],
      policies: [{ resource: "agent_evaluation", operation: "execute" }],
    },
    {
      matcher: "/admin/agent-operations/policies",
      method: "GET",
      policies: [{ resource: "agent_platform", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/prompts",
      method: "GET",
      policies: [{ resource: "agent_platform", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/model-runs",
      method: "GET",
      policies: [{ resource: "agent_platform", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/channels",
      method: "GET",
      policies: [{ resource: "agent_platform", operation: "read" }],
    },
  ],
})
