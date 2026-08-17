import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import type { MiddlewareRoute } from "@medusajs/framework/http"
import {
  AdminCreateAgentTask,
  AdminCreateKnowledgeDocument,
  AdminCreateKnowledgeSource,
  AdminCreateSupportSimulatorMessage,
  AdminConfigureAiProvider,
  AdminConfigureAiPrompt,
  AdminClearAgentConversation,
  AdminDiscoverAiModels,
  AdminDecideAgentApproval,
  AdminIngestInventoryLowEvent,
  AdminIngestOrderExceptionEvent,
  AdminIngestSupportRequest,
  AdminGoogleKnowledgeOAuthCallback,
  AdminRunAgentEvaluation,
  AdminRequestAgentAction,
  AdminRetireKnowledgeDocument,
  AdminSearchKnowledge,
  AdminSendAgentConversationMessage,
  AdminSendSupportSimulatorReply,
  AdminTransitionAgentTask,
  TelegramWebhookUpdate,
} from "./admin/agent-operations/validators"
import { StoreCreateCustomerChatMessage } from "./store/customer-chat/validators"
import { shippingHubMiddlewares } from "./admin/shipping/middlewares"
import { getGhnSettings } from "../modules/shipping-hub/ghn-connection"
import { getGhtkSettings } from "../modules/shipping-hub/ghtk-connection"

  const routes: MiddlewareRoute[] = [
    ...shippingHubMiddlewares,
    {
      matcher: "/store/carts/:id/shipping-methods",
      method: "POST",
      middlewares: [
        async (req, _res, next) => {
          try {
            // Fulfillment providers receive a scoped cradle rather than the
            // application container. Hydrate the selected carrier from the
            // encrypted connection before Medusa calculates its live price.
            await getGhnSettings(req.scope)
            await getGhtkSettings(req.scope)
            next()
          } catch (error) {
            next(error)
          }
        },
      ],
    },

    {
      matcher: "/webhooks/agent-operations/telegram/:id",
      method: "POST",
      middlewares: [validateAndTransformBody(TelegramWebhookUpdate)],
    },
    {
      matcher: "/store/customer-chat/messages",
      method: "POST",
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        validateAndTransformBody(StoreCreateCustomerChatMessage),
      ],
    },
    {
      matcher: "/store/customer-chat/customer/active-conversation",
      method: "GET",
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/store/customer-chat/conversations/:id",
      method: "GET",
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/store/customer-chat/conversations/:id/stream",
      method: "GET",
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
      ],
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
      matcher: "/admin/agent-operations/conversations/stream",
      method: "GET",
      policies: [{ resource: "agent_conversation", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/conversations/:id",
      method: "GET",
      policies: [{ resource: "agent_conversation", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/conversations/:id/clear-history",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminClearAgentConversation)],
      policies: [{ resource: "agent_conversation", operation: "delete" }],
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
      matcher: "/admin/agent-operations/tasks/:id/send-reviewed-reply",
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
      matcher: "/admin/agent-operations/knowledge/sources",
      method: "GET",
      policies: [{ resource: "agent_knowledge", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/sources",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminCreateKnowledgeSource)],
      policies: [{ resource: "agent_knowledge", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/sources/google-status",
      method: "GET",
      policies: [{ resource: "agent_knowledge", operation: "read" }],
    },
    {
      matcher:
        "/admin/agent-operations/knowledge/sources/google-oauth/authorize",
      method: "POST",
      policies: [{ resource: "agent_knowledge", operation: "create" }],
    },
    {
      matcher:
        "/admin/agent-operations/knowledge/sources/google-oauth/callback",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(AdminGoogleKnowledgeOAuthCallback, {}),
      ],
      policies: [{ resource: "agent_knowledge", operation: "create" }],
    },
    {
      matcher:
        "/admin/agent-operations/knowledge/sources/google-oauth/picker-token",
      method: "POST",
      policies: [{ resource: "agent_knowledge", operation: "read" }],
    },
    {
      matcher:
        "/admin/agent-operations/knowledge/sources/google-oauth/disconnect",
      method: "POST",
      policies: [{ resource: "agent_knowledge", operation: "delete" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/sources/:id/sync",
      method: "POST",
      policies: [{ resource: "agent_knowledge", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/sources/:id/prepare",
      method: "POST",
      policies: [{ resource: "agent_knowledge", operation: "create" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/sources/:id",
      method: "DELETE",
      policies: [{ resource: "agent_knowledge", operation: "delete" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/:id",
      method: "GET",
      policies: [{ resource: "agent_knowledge", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/:id/retire",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminRetireKnowledgeDocument)],
      policies: [{ resource: "agent_knowledge", operation: "approve" }],
    },
    {
      matcher: "/admin/agent-operations/knowledge/search",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminSearchKnowledge)],
      policies: [{ resource: "agent_knowledge", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/ai/providers",
      method: "GET",
      policies: [{ resource: "agent_ai_provider", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/ai/providers/:provider",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminConfigureAiProvider)],
      policies: [{ resource: "agent_ai_provider", operation: "configure" }],
    },
    {
      matcher: "/admin/agent-operations/ai/providers/:provider/models",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminDiscoverAiModels)],
      policies: [{ resource: "agent_ai_provider", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/ai/prompt",
      method: "GET",
      policies: [{ resource: "agent_ai_provider", operation: "read" }],
    },
    {
      matcher: "/admin/agent-operations/ai/prompt",
      method: "POST",
      middlewares: [validateAndTransformBody(AdminConfigureAiPrompt)],
      policies: [{ resource: "agent_ai_provider", operation: "configure" }],
    },
    {
      matcher: "/admin/agent-operations/ai/providers/:provider",
      method: "DELETE",
      policies: [{ resource: "agent_ai_provider", operation: "delete" }],
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
    {
      matcher: "/admin/dev-access",
      method: "GET",
      policies: [{ resource: "agent_platform", operation: "read" }],
    },
    {
      matcher: "/admin/dev-access",
      method: "POST",
      policies: [{ resource: "agent_platform", operation: "configure" }],
    },
]

export default defineMiddlewares({ routes })
