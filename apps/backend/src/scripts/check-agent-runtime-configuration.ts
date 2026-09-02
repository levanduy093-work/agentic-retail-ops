import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import { getCredentialVaultStatus } from "../modules/agent-operations/credential-vault"
import { getGoogleKnowledgeOAuthPlatformStatus } from "../modules/agent-operations/google-knowledge-oauth"
import {
  getKnowledgeRagRuntimeStatus,
  probeKnowledgeRagRuntime,
} from "../modules/agent-operations/knowledge-rag-engine"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { TelegramChannelConfig } from "../modules/agent-operations/telegram"
import {
  AI_PROVIDER_PRIORITY,
  sortAiProvidersByPriority,
} from "../modules/agent-operations/ai-provider-routing"

export default async function checkAgentRuntimeConfiguration({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [providers, googleConnection, activePrompts, telegramConnections, ragProbe] =
    await Promise.all([
      service.getAiProviderStatuses("default"),
      service.getGoogleKnowledgeConnectorStatus("default"),
      service.listAgentPromptTemplates({ status: "ACTIVE" }),
      service.listAgentChannelConnections({
        channel: "TELEGRAM",
        status: "ACTIVE",
        tenant_id: "default",
      }),
      probeKnowledgeRagRuntime(),
    ])
  const vault = getCredentialVaultStatus()
  const googlePlatform = getGoogleKnowledgeOAuthPlatformStatus()
  const rag = getKnowledgeRagRuntimeStatus()
  const embeddingProviders = sortAiProvidersByPriority(
    providers.filter((provider) => provider.embedding_enabled),
    "embedding"
  )
  const generationProviders = sortAiProvidersByPriority(
    providers.filter((provider) => provider.generation_enabled),
    "generation"
  )
  const embeddingProvider = embeddingProviders[0]
  const generationProvider = generationProviders[0]
  const telegramConnection = telegramConnections[0]
  const telegramConfig = (telegramConnection?.config ?? {}) as Record<
    string,
    unknown
  >
  const telegramTypedConfig = telegramConnection
    ? (telegramConnection.config as TelegramChannelConfig)
    : null
  const telegramHasCustomer = Boolean(
    telegramTypedConfig &&
      (telegramTypedConfig.allow_unmapped_users === true ||
        telegramTypedConfig.identities.length > 0)
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
    qdrant_reachable: ragProbe.reachable,
    distributed_locking_ready:
      process.env.REDIS_INFRASTRUCTURE_ENABLED?.trim().toLowerCase() ===
        "true" && Boolean(process.env.LOCKING_REDIS_URL?.trim()),
    telegram_bot_token_configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim()
    ),
    telegram_public_url_configured: Boolean(
      process.env.TELEGRAM_PUBLIC_BASE_URL?.trim()
    ),
    telegram_webhook_secret_configured: Boolean(
      process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
    ),
    telegram_channel_active: Boolean(telegramConnection),
    telegram_has_customer_access: telegramHasCustomer,
    telegram_security_controls_enabled: true,
    telegram_security_policy_persisted: Boolean(telegramTypedConfig?.security),
    telegram_has_authorized_users:
      telegramConfig.allow_unmapped_users === true ||
      (Array.isArray(telegramConfig.identities) &&
        telegramConfig.identities.length > 0),
  }

  console.log(
    JSON.stringify(
      {
        checks,
        providers: {
          embedding: embeddingProvider?.provider ?? null,
          embedding_failover: embeddingProviders.map(
            (provider) => provider.provider
          ),
          embedding_priority: AI_PROVIDER_PRIORITY.embedding,
          generation: generationProvider?.provider ?? null,
          generation_failover: generationProviders.map(
            (provider) => provider.provider
          ),
          generation_priority: AI_PROVIDER_PRIORITY.generation,
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
          checks.qdrant_reachable &&
          checks.embedding_provider_selected_in_admin,
        ready_for_telegram_knowledge_qa:
          checks.telegram_bot_token_configured &&
          checks.telegram_public_url_configured &&
          checks.telegram_webhook_secret_configured &&
          checks.telegram_channel_active &&
          checks.telegram_has_customer_access &&
          checks.embedding_provider_selected_in_admin &&
          checks.generation_provider_selected_in_admin &&
          checks.qdrant_url_configured &&
          checks.qdrant_reachable,
        ready_for_production_telegram:
          checks.telegram_bot_token_configured &&
          checks.telegram_public_url_configured &&
          checks.telegram_webhook_secret_configured &&
          checks.telegram_channel_active &&
          checks.telegram_security_controls_enabled &&
          checks.telegram_security_policy_persisted &&
          checks.distributed_locking_ready,
      },
      null,
      2
    )
  )
}
