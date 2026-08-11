import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import { getCredentialVaultStatus } from "../modules/agent-operations/credential-vault"
import { getGoogleKnowledgeOAuthPlatformStatus } from "../modules/agent-operations/google-knowledge-oauth"
import { getKnowledgeRagRuntimeStatus } from "../modules/agent-operations/knowledge-rag-engine"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function checkAgentRuntimeConfiguration({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [providers, googleConnection, activePrompts] = await Promise.all([
    service.getAiProviderStatuses("default"),
    service.getGoogleKnowledgeConnectorStatus("default"),
    service.listAgentPromptTemplates({ status: "ACTIVE" }),
  ])
  const vault = getCredentialVaultStatus()
  const googlePlatform = getGoogleKnowledgeOAuthPlatformStatus()
  const rag = getKnowledgeRagRuntimeStatus()
  const embeddingProvider = providers.find(
    (provider) => provider.embedding_enabled
  )
  const generationProvider = providers.find(
    (provider) => provider.generation_enabled
  )

  const checks = {
    active_prompt: activePrompts.length > 0,
    credential_vault_ready: vault.ready,
    dedicated_credential_key: vault.uses_dedicated_key,
    embedding_provider_selected_in_admin: Boolean(embeddingProvider),
    generation_provider_selected_in_admin: Boolean(generationProvider),
    google_knowledge_account_connected: googleConnection.connected,
    google_knowledge_platform_ready: googlePlatform.platform_ready,
    qdrant_url_configured: rag.qdrant_configured,
    telegram_bot_token_configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim()
    ),
    telegram_public_url_configured: Boolean(
      process.env.TELEGRAM_PUBLIC_BASE_URL?.trim()
    ),
    telegram_webhook_secret_configured: Boolean(
      process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
    ),
  }

  console.log(
    JSON.stringify(
      {
        checks,
        providers: {
          embedding: embeddingProvider?.provider ?? null,
          generation: generationProvider?.provider ?? null,
        },
        ready_for_ai_customer_support:
          checks.active_prompt &&
          checks.credential_vault_ready &&
          checks.generation_provider_selected_in_admin,
        ready_for_google_rag:
          checks.credential_vault_ready &&
          checks.google_knowledge_platform_ready &&
          checks.google_knowledge_account_connected &&
          checks.qdrant_url_configured &&
          checks.embedding_provider_selected_in_admin,
      },
      null,
      2
    )
  )
}
