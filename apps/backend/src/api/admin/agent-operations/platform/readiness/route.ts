import { IRbacModuleService } from "@medusajs/framework/types"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import {
  getKnowledgeRagRuntimeStatus,
  probeKnowledgeRagRuntime,
} from "../../../../../modules/agent-operations/knowledge-rag-engine"
import { getAgentToolCoverage } from "../../../../../modules/agent-operations/tool-registry"
import { sortAiProvidersByPriority } from "../../../../../modules/agent-operations/ai-provider-routing"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const rbac = req.scope.resolve<IRbacModuleService>(Modules.RBAC)
  const toolCoverage = getAgentToolCoverage()
  const ragStatus = getKnowledgeRagRuntimeStatus()
  const [roles, policies, prompts, scenarios, channels, aiProviders, ragProbe] = await Promise.all([
    rbac.listRbacRoles({ name: "operations_manager" }),
    service.listAgentPolicyDefinitions({ status: "ACTIVE" }),
    service.listAgentPromptTemplates({ status: "ACTIVE" }),
    service.listAgentEvaluationCases({ status: "ACTIVE" }),
    service.listAgentChannelConnections({ status: "ACTIVE" }),
    service.getAiProviderStatuses("default"),
    probeKnowledgeRagRuntime(),
  ])
  const checks = {
    active_channel: channels.length > 0,
    active_evaluation_scenarios: scenarios.length >= 2,
    active_policy: policies.length > 0,
    active_prompt: prompts.length > 0,
    model_provider_configured: aiProviders.some(
      (provider) => provider.generation_enabled
    ),
    operations_manager_role: roles.length > 0,
    redis_infrastructure_enabled:
      process.env.REDIS_INFRASTRUCTURE_ENABLED === "true" &&
      Boolean(process.env.REDIS_URL),
    rag_provider_configured:
      ragStatus.enabled &&
      ragStatus.qdrant_configured &&
      aiProviders.some((provider) => provider.embedding_enabled),
    rag_provider_reachable: ragProbe.reachable,
    tool_catalog_complete: toolCoverage.complete,
    typed_tool_executor: toolCoverage.registered_count > 0,
  }
  const embeddingProviders = sortAiProvidersByPriority(
    aiProviders.filter((provider) => provider.embedding_enabled),
    "embedding"
  )
  const generationProviders = sortAiProvidersByPriority(
    aiProviders.filter((provider) => provider.generation_enabled),
    "generation"
  )

  res.json({
    checks,
    code_ready: Object.entries(checks)
      .filter(([key]) =>
        [
          "active_channel",
          "active_evaluation_scenarios",
          "active_policy",
          "active_prompt",
          "operations_manager_role",
          "typed_tool_executor",
        ].includes(key)
      )
      .every(([, value]) => value),
    deployment_ready: Object.values(checks).every(Boolean),
    tool_coverage: toolCoverage,
    rag: {
      ...ragStatus,
      admin_embedding_provider:
        embeddingProviders[0]?.provider ?? null,
      probe: ragProbe,
    },
    routing: {
      embedding: embeddingProviders.map((provider) => provider.provider),
      generation: generationProviders.map((provider) => provider.provider),
    },
  })
}
