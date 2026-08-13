import { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import { AI_PROVIDER_PRIORITY } from "../modules/agent-operations/ai-provider-routing"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { configureAiProviderWorkflow } from "../workflows/agent-operations/configure-ai-provider"

export default async function applyAiProviderPriority({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const tenantId = "default"
  const statuses = await service.getAiProviderStatuses(tenantId)
  const configured = statuses.filter((provider) => provider.configured)

  if (!configured.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Connect at least one AI provider before applying provider priority."
    )
  }

  for (const provider of configured) {
    await configureAiProviderWorkflow(container).run({
      input: {
        actor_id: "ai-provider-priority-operator",
        embedding_dimensions: provider.embedding_dimensions,
        embedding_enabled:
          provider.supports_embedding && provider.embedding_enabled,
        embedding_model: provider.embedding_model,
        generation_enabled: true,
        generation_model: provider.generation_model,
        provider: provider.provider,
        tenant_id: tenantId,
      },
    })
  }

  const generation = await service.getActiveAiProviderCredentials(
    "generation",
    tenantId
  )
  const embedding = await service.getActiveAiProviderCredentials(
    "embedding",
    tenantId
  )

  console.log(
    JSON.stringify(
      {
        configured_embedding_chain: embedding.map(
          (credential) => credential.provider
        ),
        configured_generation_chain: generation.map(
          (credential) => credential.provider
        ),
        embedding_priority: AI_PROVIDER_PRIORITY.embedding,
        generation_priority: AI_PROVIDER_PRIORITY.generation,
        status: "AI_PROVIDER_PRIORITY_APPLIED",
      },
      null,
      2
    )
  )
}
