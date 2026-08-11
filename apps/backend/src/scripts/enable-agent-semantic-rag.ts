import { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { configureAiProviderWorkflow } from "../workflows/agent-operations/configure-ai-provider"

export default async function enableAgentSemanticRag({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const providers = await service.getAiProviderStatuses("default")
  const provider = providers.find(
    (candidate) =>
      candidate.configured &&
      candidate.generation_enabled &&
      candidate.supports_embedding
  )

  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Connect an OpenAI or Gemini provider before enabling semantic RAG."
    )
  }

  const { result } = await configureAiProviderWorkflow(container).run({
    input: {
      actor_id: "semantic-rag-operator",
      embedding_dimensions: provider.embedding_dimensions,
      embedding_enabled: true,
      embedding_model: provider.embedding_model,
      generation_enabled: provider.generation_enabled,
      generation_model: provider.generation_model,
      provider: provider.provider,
      tenant_id: "default",
    },
  })

  console.log(
    JSON.stringify(
      {
        embedding_model: provider.embedding_model,
        knowledge_index: result.knowledge_index,
        provider: provider.provider,
        status: "SEMANTIC_RAG_ENABLED",
      },
      null,
      2
    )
  )
}
