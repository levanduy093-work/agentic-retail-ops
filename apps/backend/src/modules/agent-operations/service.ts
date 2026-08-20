import { randomBytes } from "node:crypto"
import { Context, ICachingModuleService } from "@medusajs/framework/types"
import {
  InjectTransactionManager,
  InjectManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  Modules,
} from "@medusajs/framework/utils"
import { calculateActionRetry, isAgentActionClaimable } from "./action-policy"
import {
  buildApprovalDecisionResultMessage,
  buildApprovalRequestedMessage,
  isApprovalDecisionCommandTarget,
} from "./communication"
import { analyzeInventoryLow } from "./inventory-low-analyzer"
import { analyzeOrderException } from "./order-exception-analyzer"
import {
  createModelAdapter,
  redactModelInput,
} from "./model-gateway"
import {
  CUSTOMER_VISION_OUTPUT_SCHEMA,
  CUSTOMER_VISION_PROMPT_KEY,
  CUSTOMER_VISION_PROMPT_VERSION,
  CUSTOMER_VISION_SYSTEM_PROMPT,
  CUSTOMER_VISION_TIMEOUT_MS,
  VisionDefectAnalysisOutput,
} from "./customer-vision-processor"
import {
  AiProviderPurpose,
  sortAiProvidersByPriority,
} from "./ai-provider-routing"
import {
  decryptConnectorSecret,
  encryptConnectorSecret,
} from "./credential-vault"
import {
  isVaultSecretReference,
  parseVaultSecretReference,
  resolveSecretReference,
} from "./secret-reference"
import type {
  TelegramChannelConfig,
  TelegramChannelIdentity,
} from "./telegram"
import type {
  ZaloChannelConfig,
  ZaloChannelIdentity,
  ZaloStoredCredentialPayload,
} from "./zalo"
import type {
  FacebookMessengerChannelConfig,
  FacebookMessengerIdentity,
  FacebookStoredCredentialPayload,
} from "./facebook"
import {
  createGoogleKnowledgeAccessToken,
  getGoogleKnowledgeOAuthPlatformStatus,
} from "./google-knowledge-oauth"
import type { GoogleDriveKnowledgeFetchResult } from "./google-drive-knowledge-connector"
import AgentActionRequest from "./models/agent-action-request"
import AgentApproval from "./models/agent-approval"
import AgentAuditEvent from "./models/agent-audit-event"
import AgentChannelConnection from "./models/agent-channel-connection"
import AgentChannelCredential from "./models/agent-channel-credential"
import AgentConnectorCredential from "./models/agent-connector-credential"
import AgentAiProviderCredential from "./models/agent-ai-provider-credential"
import AgentConversation from "./models/agent-conversation"
import AgentConversationMemory from "./models/agent-conversation-memory"
import AgentCustomerPreference from "./models/agent-customer-preference"
import AgentDelivery from "./models/agent-delivery"
import AgentEvaluationRun from "./models/agent-evaluation-run"
import AgentEvaluationCase from "./models/agent-evaluation-scenario"
import AgentEvent from "./models/agent-event"
import AgentIncident from "./models/agent-incident"
import AgentKnowledgeDocument from "./models/agent-knowledge-document"
import AgentKnowledgeChunk from "./models/agent-knowledge-chunk"
import AgentKnowledgeSource from "./models/agent-knowledge-source"
import AgentMessage from "./models/agent-message"
import AgentModelRun from "./models/agent-model-run"
import AgentOutboxEvent from "./models/agent-outbox-event"
import AgentPolicyDefinition from "./models/agent-policy-definition"
import AgentPromptTemplate from "./models/agent-prompt-template"
import AgentRecommendation from "./models/agent-recommendation"
import AgentRun from "./models/agent-run"
import AgentTask from "./models/agent-task"
import AgentToolCall from "./models/agent-tool-call"
import {
  calculateOutboxRetry,
  isOutboxEventClaimable,
  sanitizeOutboxError,
} from "./outbox-policy"
import {
  calculateDeliveryRetry,
  isAgentDeliveryClaimable,
} from "./delivery-policy"
import { conditionMatches, evaluatePolicies } from "./policy-engine"
import {
  assertIncidentTransition,
  canTransitionIncident,
} from "./state-machine"
import { assertSupportOrderAccess } from "./support-request-policy"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool, prepareAgentCommand } from "./tool-executor"
import { InventoryTransferInput } from "./tools/inventory-tools"
import {
  AiProvider,
  ApprovalDecisionInput,
  ApproveKnowledgeDocumentInput,
  ClaimAgentActionInput,
  ClaimAgentOutboxEventInput,
  ClaimAgentDeliveryInput,
  CompleteAgentDeliveryInput,
  CompleteAgentOutboxEventInput,
  ConfigureAiProviderInput,
  ConfigureCustomerSupportPromptInput,
  ConfigureGoogleKnowledgeConnectorInput,
  CreateAgentTaskInput,
  CreateApprovalRequestedNotificationInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeSourceInput,
  DeleteKnowledgeSourceInput,
  DisconnectGoogleKnowledgeConnectorInput,
  DisconnectAiProviderInput,
  EvaluationAssertion,
  EscalateAgentTaskInput,
  FailAgentActionInput,
  FailAgentDeliveryInput,
  FailAgentOutboxEventInput,
  IncidentStatus,
  InventoryLowEventInput,
  OrderExceptionEventInput,
  PolicyCondition,
  PrepareKnowledgeSourceInput,
  ProcessAgentConversationMessageInput,
  ProcessCustomerKnowledgeQuestionInput,
  ProcessTelegramKnowledgeQuestionInput,
  ReleaseAgentTaskInput,
  RequestAgentActionInput,
  RetireKnowledgeDocumentInput,
  SupportRequestEventInput,
  SyncKnowledgeSourceInput,
  TransitionAgentTaskInput,
} from "./types"
import { evaluateAssertions } from "./evaluation"
import {
  checksumKnowledgeContent,
  chunkKnowledgeContent,
  isKnowledgeEligible,
  isKnowledgeReadyForVectorPreparation,
} from "./knowledge"
import {
  buildCustomerSmallTalkReply,
  buildCustomerOrderLookupReply,
  buildCustomerReviewAcknowledgement,
  buildDeliveryTimeGuidanceAnswer,
  buildKnowledgeAnswerFallback,
  buildKnowledgeReviewFallback,
  buildScopedCustomerReply,
  detectKnowledgeQuestionLocale,
  resolveCustomerConversationLocale,
  formatChannelKnowledgeAnswer,
  filterKnowledgeEvidenceForQuestion,
  hasSufficientKnowledgeEvidence,
  isContextDependentKnowledgeQuestion,
  KnowledgeAnswer,
  KnowledgeAnswerModelOutput,
  KNOWLEDGE_ANSWER_MAX_TOKENS,
  KNOWLEDGE_ANSWER_OUTPUT_SCHEMA,
  KNOWLEDGE_ANSWER_PROMPT_KEY,
  KNOWLEDGE_ANSWER_PROMPT_VERSION,
  KNOWLEDGE_ANSWER_SYSTEM_PROMPT,
  KNOWLEDGE_ANSWER_TIMEOUT_MS,
  resolveGovernedKnowledgeModelOutput,
  shouldUseSemanticKnowledgeSearch,
} from "./knowledge-answer"
import {
  buildCatalogOverviewReply,
  buildProductAdvisorFallback,
  CustomerCatalogSnapshot,
  extractCustomerProductPreferences,
  formatProductAdvisorReply,
  isCatalogOverviewRequest,
  isPublicCustomerUrl,
  ProductAdvisorModelOutput,
  PRODUCT_ADVISOR_MAX_TOKENS,
  PRODUCT_ADVISOR_OUTPUT_SCHEMA,
  PRODUCT_ADVISOR_PROMPT_KEY,
  PRODUCT_ADVISOR_PROMPT_VERSION,
  PRODUCT_ADVISOR_SYSTEM_PROMPT,
  PRODUCT_ADVISOR_TIMEOUT_MS,
  resolveProductAdvisorModelOutput,
} from "./customer-product-advisor"
import {
  buildCustomerIntentReply,
  CustomerMessageIntentModelOutput,
  CustomerMessageIntentResult,
  CUSTOMER_MESSAGE_INTENT_MAX_TOKENS,
  CUSTOMER_MESSAGE_INTENT_OUTPUT_SCHEMA,
  CUSTOMER_MESSAGE_INTENT_PROMPT_KEY,
  CUSTOMER_MESSAGE_INTENT_PROMPT_VERSION,
  CUSTOMER_MESSAGE_INTENT_SYSTEM_PROMPT,
  CUSTOMER_MESSAGE_INTENT_TIMEOUT_MS,
  defaultCustomerMessageIntent,
  isCustomerAddressingShop,
  resolveCustomerMessageIntent,
} from "./customer-message-intent"
import {
  CustomerConversationIntent,
  CustomerConversationModelOutput,
  CustomerConversationModelResult,
  CUSTOMER_CONVERSATION_MAX_TOKENS,
  CUSTOMER_CONVERSATION_OUTPUT_SCHEMA,
  CUSTOMER_CONVERSATION_PROMPT_KEY,
  CUSTOMER_CONVERSATION_PROMPT_VERSION,
  CUSTOMER_CONVERSATION_SYSTEM_PROMPT,
  CUSTOMER_CONVERSATION_TIMEOUT_MS,
  isSafeCustomerConversationBody,
} from "./customer-conversation-responder"
import {
  detectHybridIntent,
  runCustomerSupportReadToolLoop,
  synthesizeHybridAnswer,
} from "./customer-react-engine"
import { analyzeCustomerSentiment } from "./customer-sentiment-analyzer"
import { evaluateConversationQuality } from "./customer-csat-evaluator"
import {
  CustomerChatSecurityConfig,
  isExplicitPromptAttack,
  normalizeCustomerChatSecurityConfig,
} from "./customer-chat-security"
import { isCustomerSupportConversation } from "./channel-principal"
import {
  AssistantSettings,
  AssistantSettingsSchema,
  ASSISTANT_SETTINGS_PROMPT_KEY,
  DEFAULT_ASSISTANT_SETTINGS,
  MANAGED_PROMPTS_REGISTRY,
} from "./assistant-settings"
import {
  createKnowledgeRagEngine,
  deleteKnowledgeDocumentVectors,
} from "./knowledge-rag-engine"
import {
  assertAgentTaskRelease,
  assertAgentTaskTransition,
} from "./task-state-machine"
import {
  AuditSearchInput,
  AuditSearchOutput,
  buildTraceReplayOutput,
  formatAuditSearchResult,
  KnowledgeSearchInput,
  KnowledgeSearchOutput,
  searchKnowledgeChunks,
  searchKnowledgeChunksHybrid,
  TraceReplayInput,
  TraceReplayOutput,
  TraceTimelineEntry,
} from "./tools/platform-read-tools"
import {
  TASK_ASSIGN_TOOL,
  TASK_CREATE_TOOL,
  TASK_ESCALATE_TOOL,
  TaskAssignInput,
  TaskCommandOutput,
  TaskCreateInput,
  TaskEscalateInput,
  toGovernedTaskSnapshot,
} from "./tools/task-tools"
import {
  APPROVAL_DECIDE_TOOL,
  APPROVAL_REQUEST_TOOL,
  INCIDENT_CREATE_TOOL,
  INCIDENT_UPDATE_TOOL,
  KNOWLEDGE_PROPOSE_TOOL,
  MESSAGE_SEND_TOOL,
  PlatformCommandOutput,
} from "./tools/platform-command-tools"

type IndexableKnowledgeDocument = {
  document_key: string
  id: string
  locale: string
  scope: string
  tenant_id: string
  title: string
  version: string
}

function readMemoryItems(value: unknown) {
  if (!value || typeof value !== "object") return []
  const items = (value as { items?: unknown }).items
  return Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string")
    : []
}
import { OrderReadOutput } from "./tools/order-tools"
import {
  draftCustomerResponse,
  ResponseDraftInput,
  ResponseDraftOutput,
} from "./tools/response-tools"
import {
  CUSTOMER_SUPPORT_DEFAULT_INPUT_SCHEMA,
  CUSTOMER_SUPPORT_DEFAULT_MAX_TOKENS,
  CUSTOMER_SUPPORT_DEFAULT_OUTPUT_SCHEMA,
  CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT,
  CUSTOMER_SUPPORT_PROMPT_KEY,
  CUSTOMER_SUPPORT_PROMPT_VERSION,
} from "./customer-support-prompt"
import { listAiProviderModels } from "./ai-provider-models"
import {
  buildConversationMemoryFallback,
  buildCustomerConversationContext,
  ConversationMemoryModelOutput,
  CONVERSATION_MEMORY_MAX_TOKENS,
  CONVERSATION_MEMORY_OUTPUT_SCHEMA,
  CONVERSATION_MEMORY_PROMPT_KEY,
  CONVERSATION_MEMORY_PROMPT_VERSION,
  CONVERSATION_MEMORY_SYSTEM_PROMPT,
  CONVERSATION_MEMORY_TIMEOUT_MS,
  formatRelativeTime,
  analyzeConversationTimeGap,
  isSafeConversationMemoryOutput,
  hasExplicitHistoricalCustomerReference,
  mergeConversationMemoryOutput,
  startsExplicitNewProductTopic,
  shouldRefreshConversationMemoryWithAi,
} from "./conversation-memory"
import {
  addDays,
  CUSTOMER_PREFERENCE_EXPIRY_DAYS,
  extractExplicitCustomerPreferences,
  formatCustomerProfilePreferences,
} from "./customer-preferences"
import {
  buildCustomerAssistantCacheKey,
  CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS,
  normalizeCustomerCacheText,
  readCustomerAssistantCache,
  writeCustomerAssistantCache,
} from "./customer-assistant-cache"
import { agentRealtimeHub } from "./realtime-hub"

class AgentOperationsModuleService extends MedusaService({
  AgentActionRequest,
  AgentApproval,
  AgentAuditEvent,
  AgentChannelConnection,
  AgentChannelCredential,
  AgentConnectorCredential,
  AgentAiProviderCredential,
  AgentConversation,
  AgentConversationMemory,
  AgentCustomerPreference,
  AgentDelivery,
  AgentEvaluationRun,
  AgentEvaluationCase,
  AgentEvent,
  AgentIncident,
  AgentKnowledgeDocument,
  AgentKnowledgeChunk,
  AgentKnowledgeSource,
  AgentMessage,
  AgentModelRun,
  AgentOutboxEvent,
  AgentPolicyDefinition,
  AgentPromptTemplate,
  AgentRecommendation,
  AgentRun,
  AgentTask,
  AgentToolCall,
}) {
  async broadcastMessageCreated(msg: {
    body: string
    channel: string
    conversation_id: string
    direction: "INBOUND" | "OUTBOUND"
    id: string
    message_type: string
    occurred_at: string | Date
    product_media?: Array<{
      image_url: string
      product_id: string
      product_url?: string | null
      title: string
    }>
    sender_id: string
    sender_type: string
    status: string
    structured_content?: Record<string, unknown> | null
  }) {
    agentRealtimeHub.emitMessageCreated({
      body: msg.body,
      channel: msg.channel,
      conversation_id: msg.conversation_id,
      direction: msg.direction,
      id: msg.id,
      message_type: msg.message_type,
      occurred_at:
        msg.occurred_at instanceof Date
          ? msg.occurred_at.toISOString()
          : String(msg.occurred_at),
      product_media: msg.product_media,
      sender_id: msg.sender_id,
      sender_type: msg.sender_type,
      status: msg.status,
      structured_content: msg.structured_content,
    })
  }

  async broadcastConversationUpdated(conv: {
    channel: string
    id: string
    last_message_at: string | Date
    metadata?: Record<string, unknown> | null
    title?: string | null
  }) {
    agentRealtimeHub.emitConversationUpdated({
      channel: conv.channel,
      conversation_id: conv.id,
      id: conv.id,
      last_message_at:
        conv.last_message_at instanceof Date
          ? conv.last_message_at.toISOString()
          : String(conv.last_message_at),
      requires_human_attention: Boolean(
        conv.metadata?.requires_human_attention
      ),
      title: conv.title ?? "Customer Support",
    })
  }

  async broadcastTaskUpdated(task: {
    assigned_to_id: string | null
    id: string
    priority: string
    status: string
    support_conversation_id: string | null
    task_type: string
  }) {
    agentRealtimeHub.emitTaskUpdated({
      assigned_to_id: task.assigned_to_id,
      id: task.id,
      priority: task.priority,
      status: task.status,
      support_conversation_id: task.support_conversation_id,
      task_type: task.task_type,
    })
  }
  protected getCustomerAssistantCaching() {
    return (
      this as unknown as {
        __container__: Record<string, unknown>
      }
    ).__container__[Modules.CACHING] as ICachingModuleService | undefined
  }

  @InjectManager()
  async getPromptConfiguration(
    promptKey: string,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const metadata = MANAGED_PROMPTS_REGISTRY[promptKey]
    const defaultMaxTokens =
      metadata?.default_max_tokens ?? CUSTOMER_SUPPORT_DEFAULT_MAX_TOKENS
    const defaultSystemPrompt =
      metadata?.default_system_prompt ?? CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT
    const defaultVersion =
      metadata?.version ?? CUSTOMER_SUPPORT_PROMPT_VERSION
    const title = metadata?.title ?? promptKey
    const description = metadata?.description ?? ""

    const prompts = await this.listAgentPromptTemplates(
      { prompt_key: promptKey, status: "ACTIVE" },
      { order: { created_at: "DESC" }, take: 1 },
      sharedContext
    )
    const active = prompts[0]

    return {
      customized: Boolean(
        active && active.system_prompt !== defaultSystemPrompt
      ),
      default_max_tokens: defaultMaxTokens,
      default_system_prompt: defaultSystemPrompt,
      description,
      max_tokens: active?.max_tokens ?? defaultMaxTokens,
      prompt_key: promptKey,
      system_prompt: active?.system_prompt ?? defaultSystemPrompt,
      title,
      updated_at: active?.updated_at ?? null,
      version: active?.version ?? defaultVersion,
    }
  }

  @InjectManager()
  async getCustomerSupportPromptConfiguration(
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.getPromptConfiguration(
      CUSTOMER_SUPPORT_PROMPT_KEY,
      sharedContext
    )
  }

  @InjectManager()
  async getAssistantSettings(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AssistantSettings> {
    const prompts = await this.listAgentPromptTemplates(
      { prompt_key: ASSISTANT_SETTINGS_PROMPT_KEY, status: "ACTIVE" },
      { order: { created_at: "DESC" }, take: 1 },
      sharedContext
    )
    const active = prompts[0]
    if (!active?.system_prompt) return { ...DEFAULT_ASSISTANT_SETTINGS }
    try {
      const parsed = JSON.parse(active.system_prompt)
      const valid = AssistantSettingsSchema.safeParse(parsed)
      return valid.success ? valid.data : { ...DEFAULT_ASSISTANT_SETTINGS }
    } catch {
      return { ...DEFAULT_ASSISTANT_SETTINGS }
    }
  }

  @InjectManager()
  async configureAssistantSettings(
    input: { actor_id?: string; settings: Partial<AssistantSettings> },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureAssistantSettings_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async configureAssistantSettings_(
    input: { actor_id?: string; settings: Partial<AssistantSettings> },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const current = await this.getAssistantSettings(sharedContext)
    const merged = AssistantSettingsSchema.parse({
      ...current,
      ...input.settings,
    })
    const activePrompts = await this.listAgentPromptTemplates(
      { prompt_key: ASSISTANT_SETTINGS_PROMPT_KEY, status: "ACTIVE" },
      { order: { created_at: "DESC" } },
      sharedContext
    )
    const now = new Date()
    const version = `settings-${now.toISOString().replace(/[-:.]/g, "")}`
    const prompt = await this.createAgentPromptTemplates(
      {
        agent_id: "customer-support-agent",
        approved_at: now,
        approved_by: input.actor_id ?? "admin",
        input_schema: {},
        max_tokens: 1000,
        output_schema: {},
        prompt_key: ASSISTANT_SETTINGS_PROMPT_KEY,
        status: "ACTIVE",
        system_prompt: JSON.stringify(merged),
        version,
      },
      sharedContext
    )

    for (const active of activePrompts) {
      await this.updateAgentPromptTemplates(
        { id: active.id, status: "RETIRED" },
        sharedContext
      )
    }

    await this.createAgentAuditEvents(
      {
        action: "customer-assistant-settings-updated",
        actor_id: input.actor_id ?? "admin",
        actor_type: "user",
        correlation_id: prompt.id,
        data: merged,
      },
      sharedContext
    )

    return merged
  }

  @InjectManager()
  async listAllPromptsAndSettings(
    @MedusaContext() sharedContext: Context = {}
  ) {
    const settings = await this.getAssistantSettings(sharedContext)
    const promptKeys = Object.keys(MANAGED_PROMPTS_REGISTRY)
    const prompts = await Promise.all(
      promptKeys.map((key) => this.getPromptConfiguration(key, sharedContext))
    )
    return { prompts, settings }
  }

  @InjectManager()
  async configureManagedPrompt(
    input: {
      actor_id?: string
      max_tokens?: number
      prompt_key: string
      system_prompt: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureManagedPrompt_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async configureManagedPrompt_(
    input: {
      actor_id?: string
      max_tokens?: number
      prompt_key: string
      system_prompt: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const metadata = MANAGED_PROMPTS_REGISTRY[input.prompt_key]
    const maxTokens =
      input.max_tokens ??
      metadata?.default_max_tokens ??
      CUSTOMER_SUPPORT_DEFAULT_MAX_TOKENS

    const activePrompts = await this.listAgentPromptTemplates(
      { prompt_key: input.prompt_key, status: "ACTIVE" },
      { order: { created_at: "DESC" } },
      sharedContext
    )
    const now = new Date()
    const version = `admin-${now.toISOString().replace(/[-:.]/g, "")}`
    const prompt = await this.createAgentPromptTemplates(
      {
        agent_id: "customer-support-agent",
        approved_at: now,
        approved_by: input.actor_id ?? "admin",
        input_schema: {},
        max_tokens: maxTokens,
        output_schema: {},
        prompt_key: input.prompt_key,
        status: "ACTIVE",
        system_prompt: input.system_prompt.trim(),
        version,
      },
      sharedContext
    )

    for (const active of activePrompts) {
      await this.updateAgentPromptTemplates(
        { id: active.id, status: "RETIRED" },
        sharedContext
      )
    }

    await this.createAgentAuditEvents(
      {
        action: `prompt-${input.prompt_key}-activated`,
        actor_id: input.actor_id ?? "admin",
        actor_type: "user",
        correlation_id: prompt.id,
        data: {
          max_tokens: prompt.max_tokens,
          prompt_key: prompt.prompt_key,
          version: prompt.version,
        },
      },
      sharedContext
    )

    return this.getPromptConfiguration(input.prompt_key, sharedContext)
  }

  @InjectManager()
  async resetManagedPrompt(
    input: { actor_id?: string; prompt_key: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.resetManagedPrompt_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async resetManagedPrompt_(
    input: { actor_id?: string; prompt_key: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const keysToReset =
      input.prompt_key === "all"
        ? [
            ...Object.keys(MANAGED_PROMPTS_REGISTRY),
            ASSISTANT_SETTINGS_PROMPT_KEY,
          ]
        : [input.prompt_key]

    for (const key of keysToReset) {
      const activePrompts = await this.listAgentPromptTemplates(
        { prompt_key: key, status: "ACTIVE" },
        {},
        sharedContext
      )
      for (const active of activePrompts) {
        await this.updateAgentPromptTemplates(
          { id: active.id, status: "RETIRED" },
          sharedContext
        )
      }
    }

    await this.createAgentAuditEvents(
      {
        action: "prompts-reset-to-default",
        actor_id: input.actor_id ?? "admin",
        actor_type: "user",
        correlation_id: input.prompt_key,
        data: { prompt_key: input.prompt_key },
      },
      sharedContext
    )

    return this.listAllPromptsAndSettings(sharedContext)
  }

  @InjectManager()
  async configureCustomerSupportPrompt(
    input: ConfigureCustomerSupportPromptInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureManagedPrompt_(
      {
        actor_id: input.actor_id,
        max_tokens: input.max_tokens,
        prompt_key: CUSTOMER_SUPPORT_PROMPT_KEY,
        system_prompt: input.system_prompt,
      },
      sharedContext
    )
  }

  async getAiProviderStatuses(tenantId = "default") {
    const credentials = await this.listAgentAiProviderCredentials(
      { tenant_id: tenantId },
      { order: { provider: "ASC" } }
    )
    const byProvider = new Map(
      credentials.map((credential) => [credential.provider, credential])
    )

    return (["OPENAI", "GEMINI", "DEEPSEEK"] as const).map((provider) => {
      const credential = byProvider.get(provider)
      const defaults =
        provider === "OPENAI"
          ? {
              embedding_model: "text-embedding-3-small",
              generation_model: "gpt-4.1-mini",
            }
          : provider === "GEMINI"
            ? {
                embedding_model: "gemini-embedding-001",
                generation_model: "gemini-2.5-flash",
              }
            : {
                embedding_model: "unsupported",
                generation_model: "deepseek-v4-flash",
              }
      return {
        configured: Boolean(credential),
        embedding_dimensions: credential?.embedding_dimensions ?? null,
        embedding_enabled: credential?.embedding_enabled ?? false,
        embedding_model:
          credential?.embedding_model ?? defaults.embedding_model,
        generation_enabled: credential?.generation_enabled ?? false,
        generation_model:
          credential?.generation_model ?? defaults.generation_model,
        provider,
        secret_hint: credential?.secret_hint ?? null,
        supports_embedding: provider !== "DEEPSEEK",
        supports_generation: true,
        updated_at: credential?.updated_at ?? null,
      }
    })
  }

  async discoverAiProviderModels(input: {
    api_key?: string
    provider: AiProvider
    tenant_id?: string
  }) {
    let apiKey = input.api_key?.trim()
    if (!apiKey) {
      const credentials = await this.listAgentAiProviderCredentials(
        {
          provider: input.provider,
          tenant_id: input.tenant_id ?? "default",
        },
        { take: 1 }
      )
      const credential = credentials[0]
      if (credential) {
        apiKey = decryptConnectorSecret({
          encrypted_secret: credential.encrypted_secret,
          encryption_iv: credential.encryption_iv,
          encryption_tag: credential.encryption_tag,
          key_version: credential.key_version,
        })
      }
    }
    if (!apiKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Enter an API key before loading provider models."
      )
    }
    return listAiProviderModels({ api_key: apiKey, provider: input.provider })
  }

  async getActiveAiProviderCredentials(
    purpose: AiProviderPurpose,
    tenantId = "default"
  ) {
    const filter =
      purpose === "embedding"
        ? { embedding_enabled: true, tenant_id: tenantId }
        : { generation_enabled: true, tenant_id: tenantId }
    const credentials = await this.listAgentAiProviderCredentials(filter, {
      take: 10,
    })
    return sortAiProvidersByPriority(credentials, purpose).flatMap(
      (credential) => {
        try {
          return [
            {
              api_key: decryptConnectorSecret({
                encrypted_secret: credential.encrypted_secret,
                encryption_iv: credential.encryption_iv,
                encryption_tag: credential.encryption_tag,
                key_version: credential.key_version,
              }),
              dimensions: credential.embedding_dimensions ?? undefined,
              model:
                purpose === "embedding"
                  ? credential.embedding_model
                  : credential.generation_model,
              provider: credential.provider.toLowerCase() as
                | "deepseek"
                | "gemini"
                | "openai",
            },
          ]
        } catch {
          return []
        }
      }
    )
  }

  async getActiveAiProviderCredential(
    purpose: AiProviderPurpose,
    tenantId = "default"
  ) {
    const credentials = await this.getActiveAiProviderCredentials(
      purpose,
      tenantId
    )
    return credentials[0] ?? null
  }

  @InjectManager()
  async refreshConversationMemory(
    conversationId: string,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const conversation = await this.retrieveAgentConversation(
      conversationId,
      {},
      sharedContext
    )
    const [messages, messageCount] = await this.listAndCountAgentMessages(
      { conversation_id: conversation.id },
      { order: { occurred_at: "DESC" }, take: 6 },
      sharedContext
    )
    const latestMessage = messages[0]
    if (!latestMessage) return { memory: null, updated: false }

    const existing = (
      await this.listAgentConversationMemories(
        { conversation_id: conversation.id },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (existing?.last_message_id === latestMessage.id) {
      return { memory: existing, updated: false }
    }

    const orderedMessages = messages.slice().reverse()
    const previousMessageIndex = existing
      ? orderedMessages.findIndex(
          (message) => message.id === existing.last_message_id
        )
      : -1
    const unsummarizedMessages = orderedMessages
      .slice(previousMessageIndex >= 0 ? previousMessageIndex + 1 : -4)
      .map((message) => ({
        body: message.body.slice(0, 800),
        direction: message.direction as "INBOUND" | "OUTBOUND",
      }))
    const safeInput = {
      previous_memory: existing
        ? {
            customer_facts: readMemoryItems(existing.customer_facts),
            open_questions: readMemoryItems(existing.open_questions),
            resolved_topics: readMemoryItems(existing.resolved_topics),
            summary: existing.summary,
          }
        : null,
      recent_messages: unsummarizedMessages,
    }
    let output = buildConversationMemoryFallback({
      previous_customer_facts: existing
        ? readMemoryItems(existing.customer_facts)
        : [],
      previous_open_questions: existing
        ? readMemoryItems(existing.open_questions)
        : [],
      previous_resolved_topics: existing
        ? readMemoryItems(existing.resolved_topics)
        : [],
      previous_summary: existing?.summary,
      recent_messages: unsummarizedMessages,
    })

    if (
      shouldRefreshConversationMemoryWithAi({
        has_existing_memory: Boolean(existing),
        message_count: messageCount,
      })
    ) {
      try {
      const credentials = await this.getActiveAiProviderCredentials(
        "generation",
        conversation.tenant_id
      )
      for (const credential of credentials) {
        const adapter = createModelAdapter({
          apiKey: credential.api_key,
          model: credential.model,
          provider: credential.provider,
        })
        const attemptKey =
          `conversation-memory:${conversation.id}:${latestMessage.id}` +
          `:provider:${adapter.provider}`
        const priorRun = (
          await this.listAgentModelRuns(
            { idempotency_key: attemptKey },
            { take: 1 },
            sharedContext
          )
        )[0]
        if (priorRun?.status === "SUCCEEDED" && priorRun.output) {
          const cached = ConversationMemoryModelOutput.safeParse(
            priorRun.output
          )
          if (cached.success) {
            output = mergeConversationMemoryOutput(output, cached.data)
            break
          }
        }
        if (priorRun) continue

        const startedAt = new Date()
        const modelRun = await this.createAgentModelRuns(
          {
            agent_id: "conversation-memory-agent",
            agent_version: "1.0.0",
            idempotency_key: attemptKey,
            input: redactModelInput(safeInput) as Record<string, unknown>,
            model: adapter.model,
            prompt_key: CONVERSATION_MEMORY_PROMPT_KEY,
            prompt_version: CONVERSATION_MEMORY_PROMPT_VERSION,
            provider: adapter.provider,
            redacted: true,
            started_at: startedAt,
            status: "RUNNING",
          },
          sharedContext
        )
        try {
          const generated = await adapter.invoke({
            agent_id: "conversation-memory-agent",
            input: safeInput,
            max_tokens: CONVERSATION_MEMORY_MAX_TOKENS,
            output_schema: CONVERSATION_MEMORY_OUTPUT_SCHEMA,
            prompt_key: CONVERSATION_MEMORY_PROMPT_KEY,
            prompt_version: CONVERSATION_MEMORY_PROMPT_VERSION,
            system_prompt: CONVERSATION_MEMORY_SYSTEM_PROMPT,
            timeout_ms: CONVERSATION_MEMORY_TIMEOUT_MS,
          })
          const parsedOutput = ConversationMemoryModelOutput.parse(generated)
          if (!isSafeConversationMemoryOutput(parsedOutput)) {
            throw new MedusaError(
              MedusaError.Types.NOT_ALLOWED,
              "Conversation memory contained unsafe content."
            )
          }
          output = mergeConversationMemoryOutput(output, parsedOutput)
          await this.updateAgentModelRuns(
            {
              completed_at: new Date(),
              id: modelRun.id,
              latency_ms: Date.now() - startedAt.getTime(),
              output,
              status: "SUCCEEDED",
            },
            sharedContext
          )
          break
        } catch (error) {
          await this.updateAgentModelRuns(
            {
              completed_at: new Date(),
              error:
                error instanceof Error
                  ? error.message.slice(0, 1_000)
                  : "Conversation memory update failed",
              id: modelRun.id,
              latency_ms: Date.now() - startedAt.getTime(),
              status: "FAILED",
            },
            sharedContext
          )
        }
      }
      } catch {
        // The bounded deterministic memory remains available if all models fail.
      }
    }

    const now = new Date()
    const data = {
      customer_facts: { items: output.customer_facts },
      last_message_id: latestMessage.id,
      open_questions: { items: output.open_questions },
      resolved_topics: { items: output.resolved_topics },
      source_message_count: messageCount,
      summarized_at: now,
      summary: output.summary,
      tenant_id: conversation.tenant_id,
      version: (existing?.version ?? 0) + 1,
    }
    const memory = existing
      ? await this.updateAgentConversationMemories(
          { ...data, id: existing.id },
          sharedContext
        )
      : await this.createAgentConversationMemories(
          { ...data, conversation_id: conversation.id },
          sharedContext
        )

    await this.createAgentAuditEvents(
      {
        action: "conversation-memory-updated",
        actor_id: "conversation-memory-agent",
        actor_type: "agent",
        correlation_id: `${conversation.id}:${latestMessage.id}`,
        data: {
          conversation_id: conversation.id,
          last_message_id: latestMessage.id,
          source_message_count: messageCount,
          version: memory.version,
        },
        event_type: "agent.conversation.memory-updated",
        recorded_at: now,
        resource_id: memory.id,
        resource_type: "agent_conversation_memory",
      },
      sharedContext
    )

    return { memory, updated: true }
  }

  @InjectManager()
  async recordExplicitCustomerPreferences(
    input: {
      conversation_id: string
      customer_id: string
      message_id: string
      message: string
      tenant_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const candidates = extractExplicitCustomerPreferences(input.message)
    if (!candidates.length) return []

    const now = new Date()
    for (const candidate of candidates) {
      const existing = (
        await this.listAgentCustomerPreferences(
          {
            customer_id: input.customer_id,
            preference_type: candidate.preference_type,
            tenant_id: input.tenant_id,
            value: candidate.value,
          },
          { order: { last_confirmed_at: "DESC" }, take: 1 },
          sharedContext
        )
      )[0]
      const status: "CUSTOMER_STATED" | "CONFIRMED" =
        candidate.status === "CONFIRMED" || existing?.status === "CONFIRMED"
          ? "CONFIRMED"
          : "CUSTOMER_STATED"
      const preferenceData = {
        expires_at: addDays(now, CUSTOMER_PREFERENCE_EXPIRY_DAYS[status]),
        last_confirmed_at: now,
        source_conversation_id: input.conversation_id,
        source_message_id: input.message_id,
        status,
      }
      if (existing) {
        await this.updateAgentCustomerPreferences(
          { ...preferenceData, id: existing.id },
          sharedContext
        )
      } else {
        await this.createAgentCustomerPreferences(
          {
            ...preferenceData,
            customer_id: input.customer_id,
            preference_type: candidate.preference_type,
            tenant_id: input.tenant_id,
            value: candidate.value,
          },
          sharedContext
        )
      }
    }

    return candidates
  }

  @InjectManager()
  async configureAiProvider(
    input: ConfigureAiProviderInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureAiProvider_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async configureAiProvider_(
    input: ConfigureAiProviderInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const existing = await this.listAgentAiProviderCredentials(
      { provider: input.provider, tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const current = existing[0]
    if (!current && (!input.encrypted_api_key || !input.secret_hint)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "API key is required when connecting a provider for the first time."
      )
    }
    if (!input.embedding_enabled && !input.generation_enabled) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Enable at least one AI capability for this provider."
      )
    }
    if (input.provider === "DEEPSEEK" && input.embedding_enabled) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "DeepSeek does not provide an embedding API. Use OpenAI or Gemini for knowledge search."
      )
    }

    const encrypted = input.encrypted_api_key ?? {
      encrypted_secret: current!.encrypted_secret,
      encryption_iv: current!.encryption_iv,
      encryption_tag: current!.encryption_tag,
      key_version: current!.key_version,
    }
    const secretHint = input.secret_hint ?? current?.secret_hint
    if (!secretHint) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A secret hint is required for provider credentials."
      )
    }

    const data = {
      ...encrypted,
      embedding_dimensions: input.embedding_dimensions ?? null,
      embedding_enabled: input.embedding_enabled,
      embedding_model: input.embedding_model,
      generation_enabled: input.generation_enabled,
      generation_model: input.generation_model,
      secret_hint: secretHint,
      updated_by_id: input.actor_id,
    }
    const credential = current
      ? await this.updateAgentAiProviderCredentials(
          { ...data, id: current.id },
          sharedContext
        )
      : await this.createAgentAiProviderCredentials(
          {
            ...data,
            provider: input.provider,
            tenant_id: tenantId,
          },
          sharedContext
        )

    await this.createAgentAuditEvents(
      {
        action: current ? "ai-provider-updated" : "ai-provider-connected",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: credential.id,
        data: {
          embedding_enabled: credential.embedding_enabled,
          embedding_model: credential.embedding_model,
          generation_enabled: credential.generation_enabled,
          generation_model: credential.generation_model,
          provider: credential.provider,
        },
        event_type: "agent.ai-provider.configured",
        recorded_at: new Date(),
        resource_id: credential.id,
        resource_type: "agent_ai_provider_credential",
      },
      sharedContext
    )

    return {
      configured: true,
      embedding_enabled: credential.embedding_enabled,
      generation_enabled: credential.generation_enabled,
      provider: credential.provider,
      secret_hint: credential.secret_hint,
    }
  }

  @InjectManager()
  async disconnectAiProvider(
    input: DisconnectAiProviderInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.disconnectAiProvider_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async disconnectAiProvider_(
    input: DisconnectAiProviderInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const credentials = await this.listAgentAiProviderCredentials(
      { provider: input.provider, tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const credential = credentials[0]
    if (!credential) return { disconnected: false, provider: input.provider }

    await this.deleteAgentAiProviderCredentials(credential.id, sharedContext)
    await this.createAgentAuditEvents(
      {
        action: "ai-provider-disconnected",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: credential.id,
        data: { provider: input.provider },
        event_type: "agent.ai-provider.disconnected",
        recorded_at: new Date(),
        resource_id: credential.id,
        resource_type: "agent_ai_provider_credential",
      },
      sharedContext
    )
    return { disconnected: true, provider: input.provider }
  }

  async getGoogleKnowledgeConnectorStatus(tenantId = "default") {
    const platform = getGoogleKnowledgeOAuthPlatformStatus()
    const credentials = await this.listAgentConnectorCredentials(
      { connector_type: "GOOGLE_DRIVE", tenant_id: tenantId },
      { take: 1 }
    )
    const credential = credentials[0]

    return {
      account_email: credential?.account_email ?? null,
      connected: Boolean(platform.platform_ready && credential),
      platform_ready: platform.platform_ready,
      uses_dedicated_encryption_key: platform.uses_dedicated_encryption_key,
    }
  }

  async getGoogleKnowledgeRefreshToken(tenantId = "default") {
    const credentials = await this.listAgentConnectorCredentials(
      { connector_type: "GOOGLE_DRIVE", tenant_id: tenantId },
      { take: 1 }
    )
    const credential = credentials[0]
    if (!credential) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Connect a Google account before using Google documents."
      )
    }
    return decryptConnectorSecret({
      encrypted_secret: credential.encrypted_secret,
      encryption_iv: credential.encryption_iv,
      encryption_tag: credential.encryption_tag,
      key_version: credential.key_version,
    })
  }

  async getGoogleKnowledgePickerToken(tenantId = "default") {
    return createGoogleKnowledgeAccessToken(
      await this.getGoogleKnowledgeRefreshToken(tenantId)
    )
  }

  @InjectManager()
  async configureGoogleKnowledgeConnector(
    input: ConfigureGoogleKnowledgeConnectorInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureGoogleKnowledgeConnector_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async configureGoogleKnowledgeConnector_(
    input: ConfigureGoogleKnowledgeConnectorInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const encrypted = encryptConnectorSecret(input.refresh_token)
    const existing = await this.listAgentConnectorCredentials(
      { connector_type: "GOOGLE_DRIVE", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const current = existing[0]
    const credential = current
      ? await this.updateAgentConnectorCredentials(
          {
            ...encrypted,
            account_email: input.account_email,
            id: current.id,
            scopes: { values: input.scopes },
            updated_by_id: input.actor_id,
          },
          sharedContext
        )
      : await this.createAgentConnectorCredentials(
          {
            ...encrypted,
            account_email: input.account_email,
            connector_type: "GOOGLE_DRIVE",
            scopes: { values: input.scopes },
            tenant_id: tenantId,
            updated_by_id: input.actor_id,
          },
          sharedContext
        )

    await this.createAgentAuditEvents(
      {
        action: current
          ? "google-oauth-connection-replaced"
          : "google-oauth-connected",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: credential.id,
        data: {
          account_email: credential.account_email,
          connector_type: credential.connector_type,
          scopes: input.scopes,
        },
        event_type: "agent.connector.oauth.connected",
        recorded_at: new Date(),
        resource_id: credential.id,
        resource_type: "agent_connector_credential",
      },
      sharedContext
    )

    return {
      account_email: credential.account_email,
      connected: true,
    }
  }

  @InjectManager()
  async disconnectGoogleKnowledgeConnector(
    input: DisconnectGoogleKnowledgeConnectorInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.disconnectGoogleKnowledgeConnector_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async disconnectGoogleKnowledgeConnector_(
    input: DisconnectGoogleKnowledgeConnectorInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const credentials = await this.listAgentConnectorCredentials(
      { connector_type: "GOOGLE_DRIVE", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const credential = credentials[0]
    if (!credential) return { disconnected: false }

    await this.deleteAgentConnectorCredentials(credential.id, sharedContext)
    await this.createAgentAuditEvents(
      {
        action: "google-oauth-disconnected",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: credential.id,
        data: {
          account_email: credential.account_email,
          connector_type: credential.connector_type,
        },
        event_type: "agent.connector.oauth.disconnected",
        recorded_at: new Date(),
        resource_id: credential.id,
        resource_type: "agent_connector_credential",
      },
      sharedContext
    )

    return { disconnected: true }
  }

  async getChannelStatuses(tenantId = "default") {
    const [connections, credentials] = await Promise.all([
      this.listAgentChannelConnections(
        { tenant_id: tenantId },
        { order: { updated_at: "DESC" }, take: 50 }
      ),
      this.listAgentChannelCredentials(
        { tenant_id: tenantId },
        { order: { updated_at: "DESC" }, take: 50 }
      ),
    ])

    const telegramConn =
      connections.find((c) => c.channel === "TELEGRAM" && c.account_ref === "primary" && c.status === "ACTIVE") ??
      connections.find((c) => c.channel === "TELEGRAM" && c.account_ref === "primary") ??
      connections.find((c) => c.channel === "TELEGRAM" && c.status === "ACTIVE") ??
      connections.find((c) => c.channel === "TELEGRAM")

    const telegramCred =
      credentials.find((c) => c.channel === "TELEGRAM" && c.account_ref === "primary") ??
      credentials.find((c) => c.channel === "TELEGRAM")

    const telegramConfig = telegramConn?.config as
      | (TelegramChannelConfig & { bot_id?: string; bot_username?: string })
      | undefined

    const envBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const telegramSecretHint =
      telegramCred?.secret_hint ??
      (envBotToken
        ? `${envBotToken.slice(0, 4)}...${envBotToken.slice(-4)}`
        : null)
    const telegramPublicUrl =
      telegramCred?.public_base_url ??
      telegramConfig?.webhook_url ??
      process.env.TELEGRAM_PUBLIC_BASE_URL ??
      null

    const zaloConn =
      connections.find((c) => c.channel === "ZALO" && c.account_ref === "primary" && c.status === "ACTIVE") ??
      connections.find((c) => c.channel === "ZALO" && c.account_ref === "primary") ??
      connections.find((c) => c.channel === "ZALO" && c.status === "ACTIVE") ??
      connections.find((c) => c.channel === "ZALO")

    const zaloCred =
      credentials.find((c) => c.channel === "ZALO" && c.account_ref === "primary") ??
      credentials.find((c) => c.channel === "ZALO")

    const zaloConfig = zaloConn?.config as
      | (ZaloChannelConfig & { app_id?: string; oa_avatar?: string; oa_id?: string; oa_name?: string })
      | undefined

    const zaloSecretHint = zaloCred?.secret_hint ?? null
    const zaloPublicUrl = zaloCred?.public_base_url ?? zaloConfig?.webhook_url ?? null

    const fbConn =
      connections.find((c) => c.channel === "MESSENGER" && c.account_ref === "primary" && c.status === "ACTIVE") ??
      connections.find((c) => c.channel === "MESSENGER" && c.account_ref === "primary") ??
      connections.find((c) => c.channel === "MESSENGER" && c.status === "ACTIVE") ??
      connections.find((c) => c.channel === "MESSENGER")

    const fbCred =
      credentials.find((c) => c.channel === "MESSENGER" && c.account_ref === "primary") ??
      credentials.find((c) => c.channel === "MESSENGER")

    const fbConfig = fbConn?.config as
      | (FacebookMessengerChannelConfig & { app_id?: string; page_avatar?: string; page_id?: string; page_name?: string })
      | undefined

    const fbSecretHint = fbCred?.secret_hint ?? null
    const fbPublicUrl = fbCred?.public_base_url ?? fbConfig?.webhook_url ?? null

    return [
      {
        account_ref: telegramConn?.account_ref ?? "primary",
        allow_unmapped_users: telegramConfig?.allow_unmapped_users ?? true,
        bot_id: telegramConfig?.bot_id ?? null,
        bot_username: telegramConfig?.bot_username ?? null,
        channel: "TELEGRAM" as const,
        configured: Boolean(telegramCred || envBotToken),
        identities: telegramConfig?.identities ?? [],
        oa_avatar: null,
        public_base_url: telegramPublicUrl,
        secret_hint: telegramSecretHint,
        security: telegramConfig?.security ?? null,
        status: telegramConn?.status ?? "DISABLED",
        updated_at:
          telegramCred?.updated_at ?? telegramConn?.updated_at ?? null,
        webhook_url: telegramConfig?.webhook_url ?? null,
      },
      {
        account_ref: zaloConn?.account_ref ?? "primary",
        allow_unmapped_users: zaloConfig?.allow_unmapped_users ?? true,
        bot_id: zaloConfig?.oa_id ?? null,
        bot_username: zaloConfig?.oa_name ?? null,
        channel: "ZALO" as const,
        configured: Boolean(zaloCred),
        identities: zaloConfig?.identities ?? [],
        oa_avatar: zaloConfig?.oa_avatar ?? null,
        public_base_url: zaloPublicUrl,
        secret_hint: zaloSecretHint,
        security: zaloConfig?.security ?? null,
        status: zaloConn?.status ?? "DISABLED",
        updated_at:
          zaloCred?.updated_at ?? zaloConn?.updated_at ?? null,
        webhook_url: zaloConfig?.webhook_url ?? null,
      },
      {
        account_ref: fbConn?.account_ref ?? "primary",
        allow_unmapped_users: fbConfig?.allow_unmapped_users ?? true,
        bot_id: fbConfig?.page_id ?? null,
        bot_username: fbConfig?.page_name ?? null,
        channel: "MESSENGER" as const,
        configured: Boolean(fbCred),
        identities: fbConfig?.identities ?? [],
        oa_avatar: fbConfig?.page_avatar ?? null,
        public_base_url: fbPublicUrl,
        secret_hint: fbSecretHint,
        security: fbConfig?.security ?? null,
        status: fbConn?.status ?? "DISABLED",
        updated_at:
          fbCred?.updated_at ?? fbConn?.updated_at ?? null,
        webhook_url: fbConfig?.webhook_url ?? null,
      },
    ]
  }

  async resolveChannelBotToken(connection: {
    account_ref?: string
    channel: string
    secret_ref?: string | null
    tenant_id?: string
  }): Promise<string> {
    if (connection.channel === "MESSENGER") {
      let raw = ""
      if (connection.secret_ref && isVaultSecretReference(connection.secret_ref)) {
        const credId = parseVaultSecretReference(connection.secret_ref)
        if (credId) {
          const credential = await this.retrieveAgentChannelCredential(credId)
          raw = decryptConnectorSecret({
            encrypted_secret: credential.encrypted_secret,
            encryption_iv: credential.encryption_iv,
            encryption_tag: credential.encryption_tag,
            key_version: credential.key_version,
          })
        }
      }
      if (!raw) {
        const credentials = await this.listAgentChannelCredentials({
          account_ref: connection.account_ref ?? "primary",
          channel: "MESSENGER",
          tenant_id: connection.tenant_id ?? "default",
        })
        if (credentials.length > 0) {
          raw = decryptConnectorSecret({
            encrypted_secret: credentials[0].encrypted_secret,
            encryption_iv: credentials[0].encryption_iv,
            encryption_tag: credentials[0].encryption_tag,
            key_version: credentials[0].key_version,
          })
        }
      }

      if (raw) {
        try {
          const parsed = JSON.parse(raw) as FacebookStoredCredentialPayload
          return parsed.page_access_token || raw
        } catch {
          return raw
        }
      }
    }

    if (connection.channel === "ZALO") {
      let raw = ""
      if (connection.secret_ref && isVaultSecretReference(connection.secret_ref)) {
        const credId = parseVaultSecretReference(connection.secret_ref)
        if (credId) {
          const credential = await this.retrieveAgentChannelCredential(credId)
          raw = decryptConnectorSecret({
            encrypted_secret: credential.encrypted_secret,
            encryption_iv: credential.encryption_iv,
            encryption_tag: credential.encryption_tag,
            key_version: credential.key_version,
          })
        }
      }
      if (!raw) {
        const credentials = await this.listAgentChannelCredentials({
          account_ref: connection.account_ref ?? "primary",
          channel: "ZALO",
          tenant_id: connection.tenant_id ?? "default",
        })
        if (credentials.length > 0) {
          raw = decryptConnectorSecret({
            encrypted_secret: credentials[0].encrypted_secret,
            encryption_iv: credentials[0].encryption_iv,
            encryption_tag: credentials[0].encryption_tag,
            key_version: credentials[0].key_version,
          })
        }
      }

      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ZaloStoredCredentialPayload
          if (
            parsed.expires_at &&
            parsed.expires_at - Date.now() < 30 * 60 * 1000 &&
            parsed.refresh_token
          ) {
            try {
              return await this.refreshZaloOaAccessToken(
                connection.account_ref ?? "primary",
                connection.tenant_id ?? "default"
              )
            } catch {
              return parsed.access_token
            }
          }
          return parsed.access_token || raw
        } catch {
          return raw
        }
      }
    }

    if (connection.secret_ref && isVaultSecretReference(connection.secret_ref)) {
      const credId = parseVaultSecretReference(connection.secret_ref)
      if (credId) {
        const credential = await this.retrieveAgentChannelCredential(credId)
        return decryptConnectorSecret({
          encrypted_secret: credential.encrypted_secret,
          encryption_iv: credential.encryption_iv,
          encryption_tag: credential.encryption_tag,
          key_version: credential.key_version,
        })
      }
    }

    const credentials = await this.listAgentChannelCredentials({
      account_ref: connection.account_ref ?? "primary",
      channel: connection.channel as any,
      tenant_id: connection.tenant_id ?? "default",
    })
    if (credentials.length > 0) {
      const credential = credentials[0]
      return decryptConnectorSecret({
        encrypted_secret: credential.encrypted_secret,
        encryption_iv: credential.encryption_iv,
        encryption_tag: credential.encryption_tag,
        key_version: credential.key_version,
      })
    }

    if (connection.secret_ref && connection.secret_ref.startsWith("env:")) {
      return resolveSecretReference(connection.secret_ref)
    }

    if (connection.channel === "TELEGRAM" && process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      return process.env.TELEGRAM_BOT_TOKEN.trim()
    }

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `No bot token credential found for channel ${connection.channel}.`
    )
  }

  async resolveChannelWebhookSecret(connection: {
    account_ref?: string
    channel: string
    config?: unknown
    tenant_id?: string
  }): Promise<string> {
    const config = connection.config as TelegramChannelConfig | undefined
    const secretRef = config?.webhook_secret_ref

    if (secretRef && isVaultSecretReference(secretRef)) {
      const credId = parseVaultSecretReference(secretRef)
      if (credId) {
        const credential = await this.retrieveAgentChannelCredential(credId)
        if (
          credential.encrypted_webhook_secret &&
          credential.webhook_secret_iv &&
          credential.webhook_secret_tag
        ) {
          return decryptConnectorSecret({
            encrypted_secret: credential.encrypted_webhook_secret,
            encryption_iv: credential.webhook_secret_iv,
            encryption_tag: credential.webhook_secret_tag,
            key_version: credential.key_version,
          })
        }
      }
    }

    const credentials = await this.listAgentChannelCredentials({
      account_ref: connection.account_ref ?? "primary",
      channel: connection.channel as any,
      tenant_id: connection.tenant_id ?? "default",
    })
    if (
      credentials.length > 0 &&
      credentials[0].encrypted_webhook_secret &&
      credentials[0].webhook_secret_iv &&
      credentials[0].webhook_secret_tag
    ) {
      return decryptConnectorSecret({
        encrypted_secret: credentials[0].encrypted_webhook_secret,
        encryption_iv: credentials[0].webhook_secret_iv,
        encryption_tag: credentials[0].webhook_secret_tag,
        key_version: credentials[0].key_version,
      })
    }

    if (secretRef && secretRef.startsWith("env:")) {
      return resolveSecretReference(secretRef)
    }

    if (process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
      return process.env.TELEGRAM_WEBHOOK_SECRET.trim()
    }

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `No webhook secret found for channel ${connection.channel}.`
    )
  }

  async testTelegramBotToken(
    botToken: string,
    apiBaseUrl = "https://api.telegram.org"
  ) {
    if (!botToken?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Telegram Bot Token is required."
      )
    }
    const cleanToken = botToken.trim()
    const url = `${apiBaseUrl.replace(/\/$/, "")}/bot${cleanToken}/getMe`
    const response = await fetch(url, {
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    })
    const payload = (await response.json()) as {
      description?: string
      ok: boolean
      result?: { first_name: string; id: number; is_bot: boolean; username?: string }
    }
    if (!response.ok || !payload.ok || !payload.result) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Telegram bot verification failed: ${payload.description ?? `HTTP ${response.status}`}`
      )
    }
    return payload.result
  }

  @InjectManager()
  async configureTelegramChannelGui(
    input: {
      account_ref?: string
      actor_id: string
      allow_unmapped_users?: boolean
      api_base_url?: string
      bot_token?: string
      identities?: TelegramChannelIdentity[]
      public_base_url: string
      security?: Partial<CustomerChatSecurityConfig>
      tenant_id?: string
      webhook_secret?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureTelegramChannelGui_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async configureTelegramChannelGui_(
    input: {
      account_ref?: string
      actor_id: string
      allow_unmapped_users?: boolean
      api_base_url?: string
      bot_token?: string
      identities?: TelegramChannelIdentity[]
      public_base_url: string
      security?: Partial<CustomerChatSecurityConfig>
      tenant_id?: string
      webhook_secret?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const accountRef = input.account_ref ?? "primary"
    const apiBaseUrl = input.api_base_url ?? "https://api.telegram.org"
    const publicBaseUrl = input.public_base_url.replace(/\/$/, "")

    if (!publicBaseUrl.startsWith("https://")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Telegram public_base_url must use HTTPS."
      )
    }

    const existingCredentials = await this.listAgentChannelCredentials(
      { account_ref: accountRef, channel: "TELEGRAM", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const existingCred = existingCredentials[0]

    let resolvedBotToken: string
    if (input.bot_token?.trim()) {
      resolvedBotToken = input.bot_token.trim()
    } else if (existingCred) {
      resolvedBotToken = decryptConnectorSecret({
        encrypted_secret: existingCred.encrypted_secret,
        encryption_iv: existingCred.encryption_iv,
        encryption_tag: existingCred.encryption_tag,
        key_version: existingCred.key_version,
      })
    } else if (process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      resolvedBotToken = process.env.TELEGRAM_BOT_TOKEN.trim()
    } else {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Telegram Bot Token is required."
      )
    }

    const bot = await this.testTelegramBotToken(resolvedBotToken, apiBaseUrl)

    let resolvedWebhookSecret: string
    if (input.webhook_secret?.trim()) {
      resolvedWebhookSecret = input.webhook_secret.trim()
    } else if (
      existingCred?.encrypted_webhook_secret &&
      existingCred.webhook_secret_iv &&
      existingCred.webhook_secret_tag
    ) {
      resolvedWebhookSecret = decryptConnectorSecret({
        encrypted_secret: existingCred.encrypted_webhook_secret,
        encryption_iv: existingCred.webhook_secret_iv,
        encryption_tag: existingCred.webhook_secret_tag,
        key_version: existingCred.key_version,
      })
    } else if (process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
      resolvedWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET.trim()
    } else {
      resolvedWebhookSecret = randomBytes(24).toString("hex")
    }

    const encryptedToken = encryptConnectorSecret(resolvedBotToken)
    const encryptedSecret = encryptConnectorSecret(resolvedWebhookSecret)
    const secretHint =
      resolvedBotToken.length > 8
        ? `${resolvedBotToken.slice(0, 4)}...${resolvedBotToken.slice(-4)}`
        : `bot...${resolvedBotToken.slice(-2)}`

    const credData = {
      account_ref: accountRef,
      channel: "TELEGRAM" as const,
      encrypted_secret: encryptedToken.encrypted_secret,
      encrypted_webhook_secret: encryptedSecret.encrypted_secret,
      encryption_iv: encryptedToken.encryption_iv,
      encryption_tag: encryptedToken.encryption_tag,
      key_version: encryptedToken.key_version,
      public_base_url: publicBaseUrl,
      secret_hint: secretHint,
      tenant_id: tenantId,
      updated_by_id: input.actor_id,
      webhook_secret_iv: encryptedSecret.encryption_iv,
      webhook_secret_tag: encryptedSecret.encryption_tag,
    }

    const credential = existingCred
      ? await this.updateAgentChannelCredentials(
          { ...credData, id: existingCred.id },
          sharedContext
        )
      : await this.createAgentChannelCredentials(credData, sharedContext)

    const existingConnections = await this.listAgentChannelConnections(
      { account_ref: accountRef, channel: "TELEGRAM", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const existingConn = existingConnections[0]

    const configData: Record<string, unknown> = {
      allow_unmapped_users: input.allow_unmapped_users ?? true,
      api_base_url: apiBaseUrl,
      bot_id: String(bot.id),
      bot_username: bot.username,
      identities: input.identities ?? [],
      security: normalizeCustomerChatSecurityConfig(input.security),
      webhook_secret_ref: `vault:${credential.id}`,
    }

    const connection = existingConn
      ? await this.updateAgentChannelConnections(
          {
            config: configData,
            id: existingConn.id,
            secret_ref: `vault:${credential.id}`,
            status: "DISABLED",
          },
          sharedContext
        )
      : await this.createAgentChannelConnections(
          {
            account_ref: accountRef,
            channel: "TELEGRAM",
            config: configData,
            secret_ref: `vault:${credential.id}`,
            status: "DISABLED",
            tenant_id: tenantId,
          },
          sharedContext
        )

    const webhookUrl = `${publicBaseUrl}/webhooks/agent-operations/telegram/${connection.id}`

    const setWebhookUrl = `${apiBaseUrl.replace(/\/$/, "")}/bot${resolvedBotToken}/setWebhook`
    const setWebhookRes = await fetch(setWebhookUrl, {
      body: JSON.stringify({
        allowed_updates: ["message"],
        drop_pending_updates: false,
        max_connections: 20,
        secret_token: resolvedWebhookSecret,
        url: webhookUrl,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    })
    const webhookPayload = (await setWebhookRes.json()) as {
      description?: string
      ok: boolean
    }
    if (!setWebhookRes.ok || !webhookPayload.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Telegram setWebhook failed: ${webhookPayload.description ?? `HTTP ${setWebhookRes.status}`}`
      )
    }

    const activeConnection = await this.updateAgentChannelConnections(
      {
        config: {
          ...configData,
          webhook_url: webhookUrl,
        },
        id: connection.id,
        status: "ACTIVE",
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "telegram-channel-configured-gui",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: `telegram:connection:${activeConnection.id}`,
        data: {
          account_ref: activeConnection.account_ref,
          bot_username: bot.username,
          identity_count: (input.identities ?? []).length,
          public_questions_enabled: input.allow_unmapped_users ?? true,
          webhook_url: webhookUrl,
        },
        event_type: "agent.channel.configured",
        recorded_at: new Date(),
        resource_id: activeConnection.id,
        resource_type: "agent_channel_connection",
      },
      sharedContext
    )

    return {
      bot_username: bot.username,
      connection: activeConnection,
      secret_hint: secretHint,
      webhook_url: webhookUrl,
    }
  }

  @InjectManager()
  async disconnectTelegramChannel(
    input: { account_ref?: string; actor_id: string; tenant_id?: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.disconnectTelegramChannel_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async disconnectTelegramChannel_(
    input: { account_ref?: string; actor_id: string; tenant_id?: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const accountRef = input.account_ref ?? "primary"

    const connections = await this.listAgentChannelConnections(
      { account_ref: accountRef, channel: "TELEGRAM", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const conn = connections[0]
    if (conn) {
      try {
        const botToken = await this.resolveChannelBotToken(conn)
        const apiBaseUrl =
          (conn.config as any)?.api_base_url ?? "https://api.telegram.org"
        await fetch(
          `${apiBaseUrl.replace(/\/$/, "")}/bot${botToken}/deleteWebhook`,
          {
            headers: { "content-type": "application/json" },
            method: "POST",
            signal: AbortSignal.timeout(5_000),
          }
        )
      } catch {
        // ignore deleteWebhook failure on disconnect
      }

      await this.updateAgentChannelConnections(
        { id: conn.id, status: "DISABLED" },
        sharedContext
      )
    }

    return { disconnected: true }
  }

  async testZaloOaToken(
    accessToken: string,
    apiBaseUrl = "https://openapi.zalo.me"
  ) {
    const base = apiBaseUrl.replace(/\/$/, "")
    let res = await fetch(`${base}/v2.0/oa/getoa`, {
      headers: {
        access_token: accessToken,
      },
      signal: AbortSignal.timeout(10_000),
    })
    let payload = (await res.json()) as {
      data?: {
        avatar?: string
        description?: string
        name?: string
        oa_id?: string
        oaid?: string
      }
      error?: number
      message?: string
    }

    if (!res.ok || (payload.error && payload.error !== 0)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Zalo getoa test failed: ${payload.message ?? `HTTP ${res.status}`}`
      )
    }

    const oaId = String(payload.data?.oa_id ?? payload.data?.oaid ?? "")
    return {
      avatar: payload.data?.avatar ?? "",
      description: payload.data?.description ?? "",
      name: payload.data?.name ?? "",
      oa_id: oaId,
    }
  }

  async refreshZaloOaAccessToken(
    accountRef = "primary",
    tenantId = "default"
  ): Promise<string> {
    const credentials = await this.listAgentChannelCredentials({
      account_ref: accountRef,
      channel: "ZALO",
      tenant_id: tenantId,
    })
    const cred = credentials[0]
    if (!cred) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No Zalo OA credential found to refresh."
      )
    }

    const decrypted = decryptConnectorSecret({
      encrypted_secret: cred.encrypted_secret,
      encryption_iv: cred.encryption_iv,
      encryption_tag: cred.encryption_tag,
      key_version: cred.key_version,
    })

    let payload: ZaloStoredCredentialPayload
    try {
      payload = JSON.parse(decrypted)
    } catch {
      return decrypted
    }

    if (!payload.refresh_token || !payload.app_id || !payload.secret_key) {
      return payload.access_token
    }

    const refreshRes = await fetch("https://oauth.zalo.me/v4/oa/access_token", {
      body: new URLSearchParams({
        app_id: payload.app_id,
        grant_type: "refresh_token",
        refresh_token: payload.refresh_token,
      }),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        secret_key: payload.secret_key,
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    })
    const data = (await refreshRes.json()) as {
      access_token?: string
      error?: number
      error_description?: string
      error_name?: string
      expires_in?: string | number
      message?: string
      refresh_token?: string
    }

    if (!refreshRes.ok || data.error || !data.access_token) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Zalo token refresh failed: ${data.message ?? data.error_description ?? `HTTP ${refreshRes.status}`}`
      )
    }

    const newPayload: ZaloStoredCredentialPayload = {
      ...payload,
      access_token: data.access_token,
      expires_at: Date.now() + (Number(data.expires_in) || 90000) * 1000,
      refresh_token: data.refresh_token || payload.refresh_token,
    }

    const encryptedToken = encryptConnectorSecret(JSON.stringify(newPayload))
    await this.updateAgentChannelCredentials({
      encrypted_secret: encryptedToken.encrypted_secret,
      encryption_iv: encryptedToken.encryption_iv,
      encryption_tag: encryptedToken.encryption_tag,
      id: cred.id,
      key_version: encryptedToken.key_version,
    })

    return data.access_token
  }

  @InjectManager()
  async configureZaloChannelGui(
    input: {
      account_ref?: string
      actor_id: string
      allow_unmapped_users?: boolean
      api_base_url?: string
      app_id: string
      secret_key: string
      oa_secret_key?: string
      access_token?: string
      refresh_token?: string
      identities?: ZaloChannelIdentity[]
      public_base_url: string
      security?: Partial<CustomerChatSecurityConfig>
      tenant_id?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureZaloChannelGui_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async configureZaloChannelGui_(
    input: {
      account_ref?: string
      actor_id: string
      allow_unmapped_users?: boolean
      api_base_url?: string
      app_id: string
      secret_key: string
      oa_secret_key?: string
      access_token?: string
      refresh_token?: string
      identities?: ZaloChannelIdentity[]
      public_base_url: string
      security?: Partial<CustomerChatSecurityConfig>
      tenant_id?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const accountRef = input.account_ref ?? "primary"
    const apiBaseUrl = input.api_base_url ?? "https://openapi.zalo.me"
    const publicBaseUrl = input.public_base_url.replace(/\/$/, "")

    if (!publicBaseUrl.startsWith("https://")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Zalo public_base_url must use HTTPS."
      )
    }

    const existingCredentials = await this.listAgentChannelCredentials(
      { account_ref: accountRef, channel: "ZALO", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const existingCred = existingCredentials[0]

    let existingPayload: ZaloStoredCredentialPayload | null = null
    if (existingCred) {
      try {
        const raw = decryptConnectorSecret({
          encrypted_secret: existingCred.encrypted_secret,
          encryption_iv: existingCred.encryption_iv,
          encryption_tag: existingCred.encryption_tag,
          key_version: existingCred.key_version,
        })
        existingPayload = JSON.parse(raw)
      } catch {
        existingPayload = null
      }
    }

    const resolvedAccessToken =
      input.access_token?.trim() || existingPayload?.access_token || ""
    const resolvedRefreshToken =
      input.refresh_token?.trim() || existingPayload?.refresh_token || ""
    const resolvedAppId = input.app_id?.trim() || existingPayload?.app_id || ""
    const resolvedSecretKey =
      input.secret_key?.trim() || existingPayload?.secret_key || ""
    const resolvedOaSecretKey =
      input.oa_secret_key?.trim() || existingPayload?.oa_secret_key || ""

    if (!resolvedAccessToken) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Zalo OA Access Token is required."
      )
    }

    const oaInfo = await this.testZaloOaToken(resolvedAccessToken, apiBaseUrl)

    const credentialPayload: ZaloStoredCredentialPayload = {
      access_token: resolvedAccessToken,
      app_id: resolvedAppId,
      expires_at: Date.now() + 90000 * 1000,
      oa_avatar: oaInfo.avatar,
      oa_id: oaInfo.oa_id,
      oa_name: oaInfo.name,
      oa_secret_key: resolvedOaSecretKey,
      refresh_token: resolvedRefreshToken,
      secret_key: resolvedSecretKey,
    }

    const encryptedToken = encryptConnectorSecret(
      JSON.stringify(credentialPayload)
    )
    const encryptedOaSecret = resolvedOaSecretKey
      ? encryptConnectorSecret(resolvedOaSecretKey)
      : null

    const secretHint = oaInfo.name
      ? `OA: ${oaInfo.name} (${oaInfo.oa_id})`
      : `OA: ${oaInfo.oa_id}`

    const credData = {
      account_ref: accountRef,
      channel: "ZALO" as const,
      encrypted_secret: encryptedToken.encrypted_secret,
      encrypted_webhook_secret: encryptedOaSecret?.encrypted_secret ?? null,
      encryption_iv: encryptedToken.encryption_iv,
      encryption_tag: encryptedToken.encryption_tag,
      key_version: encryptedToken.key_version,
      public_base_url: publicBaseUrl,
      secret_hint: secretHint,
      tenant_id: tenantId,
      updated_by_id: input.actor_id,
      webhook_secret_iv: encryptedOaSecret?.encryption_iv ?? null,
      webhook_secret_tag: encryptedOaSecret?.encryption_tag ?? null,
    }

    const credential = existingCred
      ? await this.updateAgentChannelCredentials(
          { ...credData, id: existingCred.id },
          sharedContext
        )
      : await this.createAgentChannelCredentials(credData, sharedContext)

    const existingConnections = await this.listAgentChannelConnections(
      { account_ref: accountRef, channel: "ZALO", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const existingConn = existingConnections[0]

    const configData: Record<string, unknown> = {
      allow_unmapped_users: input.allow_unmapped_users ?? true,
      api_base_url: apiBaseUrl,
      app_id: resolvedAppId,
      identities: input.identities ?? [],
      oa_avatar: oaInfo.avatar,
      oa_id: oaInfo.oa_id,
      oa_name: oaInfo.name,
      security: normalizeCustomerChatSecurityConfig(input.security),
      webhook_secret_ref: `vault:${credential.id}`,
    }

    const connection = existingConn
      ? await this.updateAgentChannelConnections(
          {
            config: configData,
            id: existingConn.id,
            secret_ref: `vault:${credential.id}`,
            status: "DISABLED",
          },
          sharedContext
        )
      : await this.createAgentChannelConnections(
          {
            account_ref: accountRef,
            channel: "ZALO",
            config: configData,
            secret_ref: `vault:${credential.id}`,
            status: "DISABLED",
            tenant_id: tenantId,
          },
          sharedContext
        )

    const webhookUrl = `${publicBaseUrl}/webhooks/agent-operations/zalo/${connection.id}`

    const activeConnection = await this.updateAgentChannelConnections(
      {
        config: {
          ...configData,
          webhook_url: webhookUrl,
        },
        id: connection.id,
        status: "ACTIVE",
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "zalo-channel-configured-gui",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: `zalo:connection:${activeConnection.id}`,
        data: {
          account_ref: activeConnection.account_ref,
          oa_id: oaInfo.oa_id,
          oa_name: oaInfo.name,
          webhook_url: webhookUrl,
        },
        event_type: "agent.channel.configured",
        recorded_at: new Date(),
        resource_id: activeConnection.id,
        resource_type: "agent_channel_connection",
      },
      sharedContext
    )

    return {
      connection: activeConnection,
      oa_avatar: oaInfo.avatar,
      oa_id: oaInfo.oa_id,
      oa_name: oaInfo.name,
      secret_hint: secretHint,
      webhook_url: webhookUrl,
    }
  }

  @InjectManager()
  async disconnectZaloChannel(
    input: { account_ref?: string; actor_id: string; tenant_id?: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.disconnectZaloChannel_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async disconnectZaloChannel_(
    input: { account_ref?: string; actor_id: string; tenant_id?: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const accountRef = input.account_ref ?? "primary"

    const connections = await this.listAgentChannelConnections(
      { account_ref: accountRef, channel: "ZALO", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const conn = connections[0]
    if (conn) {
      await this.updateAgentChannelConnections(
        { id: conn.id, status: "DISABLED" },
        sharedContext
      )
    }

    return { disconnected: true }
  }

  async testFacebookPageToken(
    pageToken: string,
    apiBaseUrl = "https://graph.facebook.com/v19.0"
  ) {
    if (!pageToken?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Facebook Page Access Token is required."
      )
    }
    const cleanToken = pageToken.trim()
    const baseUrl = apiBaseUrl.replace(/\/$/, "")

    // Try reading id, name, picture first
    let response = await fetch(
      `${baseUrl}/me?fields=id,name,picture&access_token=${encodeURIComponent(cleanToken)}`,
      {
        headers: { "content-type": "application/json" },
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      }
    )
    let payload = (await response.json()) as {
      error?: { message?: string; code?: number }
      id?: string
      name?: string
      picture?: { data?: { url?: string } }
    }

    // Fallback 1: Try without picture (fields=id,name) if #100 or permission error
    if (!response.ok || payload.error || !payload.id) {
      const fallback1 = await fetch(
        `${baseUrl}/me?fields=id,name&access_token=${encodeURIComponent(cleanToken)}`,
        {
          headers: { "content-type": "application/json" },
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        }
      )
      const res1 = (await fallback1.json()) as {
        error?: { message?: string; code?: number }
        id?: string
        name?: string
      }
      if (fallback1.ok && res1.id) {
        response = fallback1
        payload = res1
      }
    }

    // Fallback 2: Try basic /me without fields query
    if (!response.ok || payload.error || !payload.id) {
      const fallback2 = await fetch(
        `${baseUrl}/me?access_token=${encodeURIComponent(cleanToken)}`,
        {
          headers: { "content-type": "application/json" },
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        }
      )
      const res2 = (await fallback2.json()) as {
        error?: { message?: string; code?: number }
        id?: string
        name?: string
      }
      if (fallback2.ok && res2.id) {
        response = fallback2
        payload = res2
      }
    }

    // Fallback 3: Try debug_token endpoint (validates Page token and retrieves Page ID without read_engagement)
    if (!response.ok || payload.error || !payload.id) {
      const debugRes = await fetch(
        `${baseUrl}/debug_token?input_token=${encodeURIComponent(cleanToken)}&access_token=${encodeURIComponent(cleanToken)}`,
        {
          headers: { "content-type": "application/json" },
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        }
      )
      const debugPayload = (await debugRes.json()) as {
        data?: {
          application?: string
          is_valid?: boolean
          profile_id?: string
          target_id?: string
        }
        error?: { message?: string }
      }
      if (debugRes.ok && debugPayload.data?.is_valid) {
        return {
          avatar: undefined,
          page_id:
            debugPayload.data.target_id ||
            debugPayload.data.profile_id ||
            "facebook-page",
          page_name: debugPayload.data.application || "Facebook Fanpage",
        }
      }
    }

    // Fallback 4: Try /me/permissions endpoint
    if (!response.ok || payload.error || !payload.id) {
      const permRes = await fetch(
        `${baseUrl}/me/permissions?access_token=${encodeURIComponent(cleanToken)}`,
        {
          headers: { "content-type": "application/json" },
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        }
      )
      const permPayload = (await permRes.json()) as {
        data?: Array<{ permission: string; status: string }>
        error?: { message?: string }
      }
      if (
        permRes.ok &&
        Array.isArray(permPayload.data) &&
        permPayload.data.length > 0
      ) {
        return {
          avatar: undefined,
          page_id: "facebook-page",
          page_name: "Facebook Fanpage (Token hợp lệ)",
        }
      }
    }

    if (!response.ok || payload.error || !payload.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Facebook verification failed: ${payload.error?.message ?? `HTTP ${response.status}`}`
      )
    }

    return {
      avatar: (payload as any).picture?.data?.url ?? undefined,
      page_id: payload.id,
      page_name: payload.name ?? `Page ${payload.id}`,
    }
  }

  @InjectManager()
  async configureMessengerChannelGui(
    input: {
      account_ref?: string
      actor_id: string
      allow_unmapped_users?: boolean
      api_base_url?: string
      app_id?: string
      app_secret?: string
      identities?: FacebookMessengerIdentity[]
      page_access_token?: string
      public_base_url: string
      security?: Partial<CustomerChatSecurityConfig>
      tenant_id?: string
      verify_token?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.configureMessengerChannelGui_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async configureMessengerChannelGui_(
    input: {
      account_ref?: string
      actor_id: string
      allow_unmapped_users?: boolean
      api_base_url?: string
      app_id?: string
      app_secret?: string
      identities?: FacebookMessengerIdentity[]
      page_access_token?: string
      public_base_url: string
      security?: Partial<CustomerChatSecurityConfig>
      tenant_id?: string
      verify_token?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const accountRef = input.account_ref ?? "primary"
    const apiBaseUrl = input.api_base_url ?? "https://graph.facebook.com/v19.0"
    const publicBaseUrl = input.public_base_url.replace(/\/$/, "")

    if (!publicBaseUrl.startsWith("https://")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Facebook Messenger public_base_url must use HTTPS."
      )
    }

    const existingCredentials = await this.listAgentChannelCredentials(
      { account_ref: accountRef, channel: "MESSENGER", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const existingCred = existingCredentials[0]

    let existingPayload: FacebookStoredCredentialPayload | null = null
    if (existingCred) {
      try {
        const raw = decryptConnectorSecret({
          encrypted_secret: existingCred.encrypted_secret,
          encryption_iv: existingCred.encryption_iv,
          encryption_tag: existingCred.encryption_tag,
          key_version: existingCred.key_version,
        })
        existingPayload = JSON.parse(raw)
      } catch {
        existingPayload = null
      }
    }

    const resolvedAccessToken =
      input.page_access_token?.trim() || existingPayload?.page_access_token || ""
    const resolvedAppSecret =
      input.app_secret?.trim() || existingPayload?.app_secret || ""
    const resolvedAppId = input.app_id?.trim() || existingPayload?.app_id || ""
    const resolvedVerifyToken =
      input.verify_token?.trim() ||
      existingPayload?.verify_token ||
      randomBytes(16).toString("hex")

    if (!resolvedAccessToken) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Facebook Page Access Token is required."
      )
    }

    const pageInfo = await this.testFacebookPageToken(resolvedAccessToken, apiBaseUrl)

    const credentialPayload: FacebookStoredCredentialPayload = {
      app_id: resolvedAppId,
      app_secret: resolvedAppSecret,
      page_access_token: resolvedAccessToken,
      page_avatar: pageInfo.avatar,
      page_id: pageInfo.page_id,
      page_name: pageInfo.page_name,
      verify_token: resolvedVerifyToken,
    }

    const encryptedToken = encryptConnectorSecret(
      JSON.stringify(credentialPayload)
    )
    const encryptedAppSecret = resolvedAppSecret
      ? encryptConnectorSecret(resolvedAppSecret)
      : null

    const secretHint = pageInfo.page_name
      ? `Page: ${pageInfo.page_name} (${pageInfo.page_id})`
      : `Page: ${pageInfo.page_id}`

    const credData = {
      account_ref: accountRef,
      channel: "MESSENGER" as const,
      encrypted_secret: encryptedToken.encrypted_secret,
      encrypted_webhook_secret: encryptedAppSecret?.encrypted_secret ?? null,
      encryption_iv: encryptedToken.encryption_iv,
      encryption_tag: encryptedToken.encryption_tag,
      key_version: encryptedToken.key_version,
      public_base_url: publicBaseUrl,
      secret_hint: secretHint,
      tenant_id: tenantId,
      updated_by_id: input.actor_id,
      webhook_secret_iv: encryptedAppSecret?.encryption_iv ?? null,
      webhook_secret_tag: encryptedAppSecret?.encryption_tag ?? null,
    }

    const credential = existingCred
      ? await this.updateAgentChannelCredentials(
          { ...credData, id: existingCred.id },
          sharedContext
        )
      : await this.createAgentChannelCredentials(credData, sharedContext)

    const existingConnections = await this.listAgentChannelConnections(
      { account_ref: accountRef, channel: "MESSENGER", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const existingConn = existingConnections[0]

    const configData: Record<string, unknown> = {
      allow_unmapped_users: input.allow_unmapped_users ?? true,
      api_base_url: apiBaseUrl,
      app_id: resolvedAppId,
      identities: input.identities ?? [],
      page_avatar: pageInfo.avatar,
      page_id: pageInfo.page_id,
      page_name: pageInfo.page_name,
      security: normalizeCustomerChatSecurityConfig(input.security),
      verify_token: resolvedVerifyToken,
      webhook_secret_ref: `vault:${credential.id}`,
    }

    const connection = existingConn
      ? await this.updateAgentChannelConnections(
          {
            config: configData,
            id: existingConn.id,
            secret_ref: `vault:${credential.id}`,
            status: "DISABLED",
          },
          sharedContext
        )
      : await this.createAgentChannelConnections(
          {
            account_ref: accountRef,
            channel: "MESSENGER",
            config: configData,
            secret_ref: `vault:${credential.id}`,
            status: "DISABLED",
            tenant_id: tenantId,
          },
          sharedContext
        )

    const webhookUrl = `${publicBaseUrl}/webhooks/agent-operations/messenger/${connection.id}`

    const activeConnection = await this.updateAgentChannelConnections(
      {
        config: {
          ...configData,
          webhook_url: webhookUrl,
        },
        id: connection.id,
        status: "ACTIVE",
      },
      sharedContext
    )

    // Automatically subscribe the Facebook Page to this App's Webhook events
    try {
      const subUrl = `${apiBaseUrl.replace(/\/$/, "")}/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(resolvedAccessToken)}`
      await fetch(subUrl, { method: "POST", signal: AbortSignal.timeout(5_000) })
    } catch {
      // Non-blocking if offline
    }

    await this.createAgentAuditEvents(
      {
        action: "messenger-channel-configured-gui",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: `messenger:connection:${activeConnection.id}`,
        data: {
          account_ref: activeConnection.account_ref,
          page_id: pageInfo.page_id,
          page_name: pageInfo.page_name,
          webhook_url: webhookUrl,
        },
        event_type: "agent.channel.configured",
        recorded_at: new Date(),
        resource_id: activeConnection.id,
        resource_type: "agent_channel_connection",
      },
      sharedContext
    )

    return {
      connection: activeConnection,
      page_avatar: pageInfo.avatar,
      page_id: pageInfo.page_id,
      page_name: pageInfo.page_name,
      secret_hint: secretHint,
      verify_token: resolvedVerifyToken,
      webhook_url: webhookUrl,
    }
  }

  @InjectManager()
  async disconnectMessengerChannel(
    input: { account_ref?: string; actor_id: string; tenant_id?: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.disconnectMessengerChannel_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async disconnectMessengerChannel_(
    input: { account_ref?: string; actor_id: string; tenant_id?: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const accountRef = input.account_ref ?? "primary"

    const connections = await this.listAgentChannelConnections(
      { account_ref: accountRef, channel: "MESSENGER", tenant_id: tenantId },
      { take: 1 },
      sharedContext
    )
    const conn = connections[0]
    if (conn) {
      await this.updateAgentChannelConnections(
        { id: conn.id, status: "DISABLED" },
        sharedContext
      )
    }

    return { disconnected: true }
  }

  @InjectManager()
  async createGovernedAgentTask(
    input: CreateAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.createGovernedAgentTask_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async createGovernedAgentTask_(
    input: CreateAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const existingTasks = await this.listAgentTasks(
      { idempotency_key: input.idempotency_key },
      { take: 1 },
      sharedContext
    )

    if (existingTasks[0]) {
      return { duplicate: true, task: existingTasks[0] }
    }

    const task = await this.createAgentTasks(
      {
        created_by_id: input.created_by_id,
        created_by_type: input.created_by_type,
        conversation_id: input.conversation_id,
        description: input.description,
        due_at: input.due_at ? new Date(input.due_at) : undefined,
        idempotency_key: input.idempotency_key,
        incident_id: input.incident_id,
        input: input.input,
        priority: input.priority,
        status: "TODO",
        task_type: input.task_type,
        tenant_id: input.tenant_id ?? "default",
        title: input.title,
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "task-created",
        actor_id: input.created_by_id,
        actor_type: input.created_by_type,
        correlation_id: input.incident_id ?? input.idempotency_key,
        data: { due_at: input.due_at, priority: input.priority },
        event_type: "agent.task.created",
        incident_id: input.incident_id,
        recorded_at: new Date(),
        resource_id: task.id,
        resource_type: "agent_task",
      },
      sharedContext
    )

    return { duplicate: false, task }
  }

  @InjectManager()
  async transitionGovernedAgentTask(
    input: TransitionAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.transitionGovernedAgentTask_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async transitionGovernedAgentTask_(
    input: TransitionAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const task = await this.retrieveAgentTask(input.task_id, {}, sharedContext)

    if (task.status !== input.expected_status) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Task ${task.id} is ${task.status}, expected ${input.expected_status}.`
      )
    }

    assertAgentTaskTransition(input.expected_status, input.status)
    const now = new Date()
    const updated = await this.updateAgentTasks(
      {
        assigned_to_id: input.assigned_to_id ?? task.assigned_to_id,
        assigned_to_type: input.assigned_to_type ?? task.assigned_to_type,
        claimed_at: input.status === "CLAIMED" ? now : task.claimed_at,
        completed_at: ["COMPLETED", "CANCELLED", "DEAD"].includes(input.status)
          ? now
          : task.completed_at,
        failure: input.failure,
        id: task.id,
        result: input.result,
        started_at: input.status === "IN_PROGRESS" ? now : task.started_at,
        status: input.status,
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "task-transitioned",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: task.incident_id ?? task.idempotency_key,
        data: { from: input.expected_status, to: input.status },
        event_type: "agent.task.transitioned",
        incident_id: task.incident_id,
        recorded_at: now,
        resource_id: task.id,
        resource_type: "agent_task",
      },
      sharedContext
    )

    return updated
  }

  @InjectManager()
  async releaseGovernedAgentTask(
    input: ReleaseAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.releaseGovernedAgentTask_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async releaseGovernedAgentTask_(
    input: ReleaseAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const task = await this.retrieveAgentTask(input.task_id, {}, sharedContext)

    assertAgentTaskRelease(task, input.actor_id)

    const now = new Date()
    const updated = await this.updateAgentTasks(
      {
        assigned_to_id: null,
        assigned_to_type: null,
        claimed_at: null,
        id: task.id,
        started_at: null,
        status: "TODO",
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "task-returned-to-queue",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: task.incident_id ?? task.idempotency_key,
        data: { from: task.status, to: "TODO" },
        event_type: "agent.task.returned-to-queue",
        incident_id: task.incident_id,
        recorded_at: now,
        resource_id: task.id,
        resource_type: "agent_task",
      },
      sharedContext
    )

    return updated
  }

  @InjectManager()
  async escalateGovernedAgentTask(
    input: EscalateAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.escalateGovernedAgentTask_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async escalateGovernedAgentTask_(
    input: EscalateAgentTaskInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const task = await this.retrieveAgentTask(input.task_id, {}, sharedContext)

    if (task.status !== input.expected_status) {
      return {
        code: "TASK_STATE_CONFLICT" as const,
        message: `Task ${task.id} is ${task.status}, expected ${input.expected_status}.`,
        outcome: "CONFLICT" as const,
        task,
      }
    }

    if (["COMPLETED", "CANCELLED", "DEAD"].includes(task.status)) {
      return {
        code: "TASK_TERMINAL" as const,
        message: `Task ${task.id} is terminal and cannot be escalated.`,
        outcome: "CONFLICT" as const,
        task,
      }
    }

    const now = new Date()
    const updated = await this.updateAgentTasks(
      {
        assigned_to_id: input.assigned_to_id,
        assigned_to_type: input.assigned_to_type,
        escalated_at: now,
        escalated_by_id: input.actor_id,
        escalation_reason: input.reason,
        id: task.id,
        priority: input.priority,
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "task-escalated",
        actor_id: input.actor_id,
        actor_type: "agent",
        correlation_id: task.incident_id ?? task.idempotency_key,
        data: {
          assigned_to_id: input.assigned_to_id,
          assigned_to_type: input.assigned_to_type,
          from_priority: task.priority,
          reason: input.reason,
          to_priority: input.priority,
        },
        event_type: "agent.task.escalated",
        incident_id: task.incident_id,
        recorded_at: now,
        resource_id: task.id,
        resource_type: "agent_task",
      },
      sharedContext
    )

    return { outcome: "SUCCEEDED" as const, task: updated }
  }

  @InjectManager()
  async createGovernedKnowledgeSource(
    input: CreateKnowledgeSourceInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.createGovernedKnowledgeSource_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async createGovernedKnowledgeSource_(
    input: CreateKnowledgeSourceInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const tenantId = input.tenant_id ?? "default"
    const existing = await this.listAgentKnowledgeSources(
      {
        locale: input.locale,
        scope: input.scope,
        source_url: input.source_url,
        tenant_id: tenantId,
      },
      { take: 1 },
      sharedContext
    )
    if (existing[0]) return { duplicate: true, source: existing[0] }

    const source = await this.createAgentKnowledgeSources(
      {
        locale: input.locale,
        name: input.name,
        owner_id: input.owner_id,
        scope: input.scope,
        source_type: input.source_type,
        source_url: input.source_url,
        status: "ACTIVE",
        tenant_id: tenantId,
      },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "knowledge-source-connected",
        actor_id: input.owner_id,
        actor_type: "user",
        correlation_id: source.id,
        data: { locale: source.locale, scope: source.scope },
        event_type: "agent.knowledge-source.connected",
        recorded_at: new Date(),
        resource_id: source.id,
        resource_type: "agent_knowledge_source",
      },
      sharedContext
    )

    return { duplicate: false, source }
  }

  @InjectManager()
  async recordKnowledgeSourceSync(
    input: SyncKnowledgeSourceInput & {
      fetch_result?: GoogleDriveKnowledgeFetchResult
      failure?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.recordKnowledgeSourceSync_(input, sharedContext)
  }

  @InjectManager()
  async deleteGovernedKnowledgeSource(
    input: DeleteKnowledgeSourceInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.deleteGovernedKnowledgeSource_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async deleteGovernedKnowledgeSource_(
    input: DeleteKnowledgeSourceInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const source = await this.retrieveAgentKnowledgeSource(
      input.source_id,
      {},
      sharedContext
    )
    const documents = await this.listAgentKnowledgeDocuments(
      { document_key: `source-${source.id}` },
      { take: 10_000 },
      sharedContext
    )
    const documentIds = documents.map((document) => document.id)
    const chunks = documentIds.length
      ? await this.listAgentKnowledgeChunks(
          { document_id: documentIds },
          { take: 50_000 },
          sharedContext
        )
      : []

    await this.createAgentAuditEvents(
      {
        action: "knowledge-source-deleted",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: source.id,
        data: {
          chunk_count: chunks.length,
          document_count: documents.length,
          source_name: source.name,
          source_type: source.source_type,
        },
        event_type: "agent.knowledge-source.deleted",
        recorded_at: new Date(),
        resource_id: source.id,
        resource_type: "agent_knowledge_source",
      },
      sharedContext
    )

    if (chunks.length) {
      await this.deleteAgentKnowledgeChunks(
        chunks.map((chunk) => chunk.id),
        sharedContext
      )
    }
    if (documentIds.length) {
      await this.deleteAgentKnowledgeDocuments(documentIds, sharedContext)
    }
    await this.deleteAgentKnowledgeSources(source.id, sharedContext)

    return {
      chunk_count: chunks.length,
      deleted: true as const,
      document_count: documents.length,
      source_id: source.id,
    }
  }

  @InjectTransactionManager()
  protected async recordKnowledgeSourceSync_(
    input: SyncKnowledgeSourceInput & {
      fetch_result?: GoogleDriveKnowledgeFetchResult
      failure?: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const source = await this.retrieveAgentKnowledgeSource(
      input.source_id,
      {},
      sharedContext
    )
    if (source.status !== "ACTIVE") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Disabled knowledge sources cannot be synchronized."
      )
    }

    const now = new Date()
    if (!input.fetch_result) {
      const updated = await this.updateAgentKnowledgeSources(
        {
          id: source.id,
          last_checked_at: now,
          last_error: input.failure ?? "Knowledge source sync failed.",
          last_sync_status: "FAILED",
        },
        sharedContext
      )
      return { document: null, source: updated, status: "FAILED" as const }
    }

    if (input.fetch_result.unchanged) {
      const updated = await this.updateAgentKnowledgeSources(
        {
          id: source.id,
          last_checked_at: now,
          last_error: null,
          last_etag: input.fetch_result.etag,
          last_sync_status: "UNCHANGED",
        },
        sharedContext
      )
      return { document: null, source: updated, status: "UNCHANGED" as const }
    }

    if (source.last_checksum === input.fetch_result.checksum) {
      const updated = await this.updateAgentKnowledgeSources(
        {
          id: source.id,
          last_checked_at: now,
          last_error: null,
          last_etag: input.fetch_result.etag,
          last_sync_status: "UNCHANGED",
        },
        sharedContext
      )
      return { document: null, source: updated, status: "UNCHANGED" as const }
    }

    const version = `sync-${input.fetch_result.checksum.slice(0, 16)}`
    const created = await this.createGovernedKnowledgeDocument_(
      {
        citation_locator: input.fetch_result.final_url,
        content: input.fetch_result.content,
        document_key: `source-${source.id}`,
        effective_at: now.toISOString(),
        locale: source.locale,
        owner_id: source.owner_id,
        scope: source.scope,
        tenant_id: source.tenant_id,
        title: source.name,
        version,
      },
      sharedContext
    )
    const updated = await this.updateAgentKnowledgeSources(
      {
        id: source.id,
        last_checked_at: now,
        last_checksum: input.fetch_result.checksum,
        last_document_id: created.document.id,
        last_error: null,
        last_etag: input.fetch_result.etag,
        last_synced_at: now,
        last_sync_status: "SUCCEEDED",
      },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "knowledge-source-synchronized",
        actor_id: input.actor_id,
        actor_type: input.actor_type ?? "user",
        correlation_id: source.id,
        data: {
          checksum: input.fetch_result.checksum,
          document_id: created.document.id,
          version,
        },
        event_type: "agent.knowledge-source.synchronized",
        recorded_at: now,
        resource_id: source.id,
        resource_type: "agent_knowledge_source",
      },
      sharedContext
    )

    return {
      document: created.document,
      source: updated,
      status: "SUCCEEDED" as const,
    }
  }

  @InjectManager()
  async createGovernedKnowledgeDocument(
    input: CreateKnowledgeDocumentInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.createGovernedKnowledgeDocument_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async createGovernedKnowledgeDocument_(
    input: CreateKnowledgeDocumentInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const existing = await this.listAgentKnowledgeDocuments(
      { document_key: input.document_key, version: input.version },
      { take: 1 },
      sharedContext
    )

    if (existing[0]) {
      return { document: existing[0], duplicate: true }
    }

    const document = await this.createAgentKnowledgeDocuments(
      {
        checksum: checksumKnowledgeContent(input.content),
        citation_locator: input.citation_locator,
        content: input.content,
        document_key: input.document_key,
        effective_at: new Date(input.effective_at),
        expires_at: input.expires_at ? new Date(input.expires_at) : undefined,
        locale: input.locale ?? "vi",
        owner_id: input.owner_id,
        scope: input.scope ?? "operations",
        status: "DRAFT",
        tenant_id: input.tenant_id ?? "default",
        title: input.title,
        version: input.version,
      },
      sharedContext
    )

    const chunks = chunkKnowledgeContent(input.content, input.citation_locator)
    await this.createAgentKnowledgeChunks(
      chunks.map((chunk) => ({
        ...chunk,
        document_id: document.id,
      })),
      sharedContext
    )

    return { chunk_count: chunks.length, document, duplicate: false }
  }

  @InjectManager()
  async ensureKnowledgeDocumentChunks(
    documentId: string,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.ensureKnowledgeDocumentChunks_(documentId, sharedContext)
  }

  @InjectTransactionManager()
  protected async ensureKnowledgeDocumentChunks_(
    documentId: string,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const existing = await this.listAgentKnowledgeChunks(
      { document_id: documentId },
      { take: 1 },
      sharedContext
    )
    if (existing[0]) {
      return { chunk_count: existing.length, created: false }
    }

    const document = await this.retrieveAgentKnowledgeDocument(
      documentId,
      {},
      sharedContext
    )
    const chunks = chunkKnowledgeContent(
      document.content,
      document.citation_locator
    )
    await this.createAgentKnowledgeChunks(
      chunks.map((chunk) => ({ ...chunk, document_id: document.id })),
      sharedContext
    )

    return { chunk_count: chunks.length, created: true }
  }

  @InjectManager()
  async approveGovernedKnowledgeDocument(
    input: ApproveKnowledgeDocumentInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.approveGovernedKnowledgeDocument_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async approveGovernedKnowledgeDocument_(
    input: ApproveKnowledgeDocumentInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const document = await this.retrieveAgentKnowledgeDocument(
      input.document_id,
      {},
      sharedContext
    )

    if (document.status === "APPROVED") {
      return { document, duplicate: true }
    }
    if (document.status !== "DRAFT") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Knowledge document ${document.id} cannot be approved from ${document.status}.`
      )
    }

    if (checksumKnowledgeContent(document.content) !== document.checksum) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Knowledge document ${document.id} content does not match its checksum.`
      )
    }

    const chunks = await this.listAgentKnowledgeChunks(
      { document_id: document.id },
      { order: { chunk_index: "ASC" } },
      sharedContext
    )
    if (!chunks.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Knowledge document ${document.id} has no searchable content.`
      )
    }

    const updated = await this.updateAgentKnowledgeDocuments(
      {
        approved_at: new Date(),
        approved_by: input.actor_id,
        id: document.id,
        status: "APPROVED",
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "knowledge-approved",
        actor_id: input.actor_id,
        actor_type: input.actor_type ?? "user",
        correlation_id: `${document.document_key}:${document.version}`,
        data: { checksum: document.checksum },
        event_type: "agent.knowledge.approved",
        recorded_at: new Date(),
        resource_id: document.id,
        resource_type: "agent_knowledge_document",
      },
      sharedContext
    )

    return { document: updated, duplicate: false }
  }

  @InjectManager()
  async retireGovernedKnowledgeDocument(
    input: RetireKnowledgeDocumentInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.retireGovernedKnowledgeDocument_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async retireGovernedKnowledgeDocument_(
    input: RetireKnowledgeDocumentInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const document = await this.retrieveAgentKnowledgeDocument(
      input.document_id,
      {},
      sharedContext
    )

    if (document.status === "RETIRED") {
      return { document, duplicate: true }
    }
    if (document.status !== "APPROVED") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Knowledge document ${document.id} cannot be retired from ${document.status}.`
      )
    }

    const updated = await this.updateAgentKnowledgeDocuments(
      { id: document.id, status: "RETIRED" },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "knowledge-retired",
        actor_id: input.actor_id,
        actor_type: input.actor_type ?? "user",
        correlation_id: `${document.document_key}:${document.version}`,
        data: { reason: input.reason },
        event_type: "agent.knowledge.retired",
        recorded_at: new Date(),
        resource_id: document.id,
        resource_type: "agent_knowledge_document",
      },
      sharedContext
    )

    return { document: updated, duplicate: false }
  }

  @InjectManager()
  async indexGovernedKnowledgeDocument(
    documentId: string,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const document = await this.retrieveAgentKnowledgeDocument(
      documentId,
      {},
      sharedContext
    )
    if (!isKnowledgeEligible(document)) {
      return {
        indexed_chunks: 0,
        provider: "disabled",
        status: "SKIPPED" as const,
      }
    }

    return this.indexKnowledgeDocument_(document, sharedContext)
  }

  @InjectManager()
  async prepareKnowledgeSourceIndex(
    input: PrepareKnowledgeSourceInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const source = await this.retrieveAgentKnowledgeSource(
      input.source_id,
      {},
      sharedContext
    )
    if (!source.last_document_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Knowledge source ${source.id} has no synchronized document to index.`
      )
    }

    const document = await this.retrieveAgentKnowledgeDocument(
      source.last_document_id,
      {},
      sharedContext
    )
    const canPrepare = isKnowledgeReadyForVectorPreparation(document)
    const ragIndex = canPrepare
      ? await this.indexKnowledgeDocument_(document, sharedContext)
      : {
          error: `Knowledge document ${document.id} cannot be indexed from ${document.status}.`,
          indexed_chunks: 0,
          provider: "disabled",
          status: "SKIPPED" as const,
        }

    if (ragIndex.status !== "INDEXED") {
      const failure =
        "error" in ragIndex
          ? ragIndex.error
          : "Vector indexing is not configured for this store."
      const updatedSource = await this.updateAgentKnowledgeSources(
        {
          id: source.id,
          last_error: failure,
          last_sync_status: "FAILED",
        },
        sharedContext
      )
      return { document, rag_index: ragIndex, source: updatedSource }
    }

    const approval =
      document.status === "DRAFT"
        ? await this.approveGovernedKnowledgeDocument_(
            {
              actor_id: input.actor_id,
              actor_type: input.actor_type,
              document_id: document.id,
            },
            sharedContext
          )
        : { document, duplicate: true }
    const supersededDocuments = (
      await this.listAgentKnowledgeDocuments(
        { document_key: document.document_key, status: "APPROVED" },
        { take: 10_000 },
        sharedContext
      )
    ).filter((candidate) => candidate.id !== document.id)

    for (const superseded of supersededDocuments) {
      await this.retireGovernedKnowledgeDocument_(
        {
          actor_id: input.actor_id,
          actor_type: input.actor_type,
          document_id: superseded.id,
          reason: `Superseded by synchronized source version ${document.version}.`,
        },
        sharedContext
      )
      await this.removeGovernedKnowledgeDocumentIndex(superseded.id, sharedContext)
    }

    const updatedSource = await this.updateAgentKnowledgeSources(
      { id: source.id, last_error: null },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "knowledge-source-prepared",
        actor_id: input.actor_id,
        actor_type: input.actor_type ?? "user",
        correlation_id: source.id,
        data: {
          document_id: document.id,
          indexed_chunks: ragIndex.indexed_chunks,
          provider: ragIndex.provider,
          auto_approved: approval.document.status === "APPROVED",
          status: approval.document.status,
          superseded_document_count: supersededDocuments.length,
        },
        event_type: "agent.knowledge-source.prepared",
        recorded_at: new Date(),
        resource_id: source.id,
        resource_type: "agent_knowledge_source",
      },
      sharedContext
    )

    return { document: approval.document, rag_index: ragIndex, source: updatedSource }
  }

  @InjectTransactionManager()
  protected async indexKnowledgeDocument_(
    document: IndexableKnowledgeDocument,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const chunks = await this.listAgentKnowledgeChunks(
      { document_id: document.id },
      { order: { chunk_index: "ASC" }, take: 10_000 },
      sharedContext
    )

    try {
      const credentials = await this.getActiveAiProviderCredentials(
        "embedding",
        document.tenant_id
      )
      if (!credentials.length) {
        return createKnowledgeRagEngine(process.env).indexDocuments([])
      }

      const vectorDocuments = chunks.map((chunk) => ({
        checksum: chunk.checksum,
        chunk_id: chunk.id,
        citation_locator: chunk.citation_locator,
        content: chunk.content,
        document_id: document.id,
        document_key: document.document_key,
        locale: document.locale,
        scope: document.scope,
        tenant_id: document.tenant_id,
        title: document.title,
        version: document.version,
      }))
      let primaryResult
      let lastError: unknown

      for (const credential of credentials) {
        try {
          const result = await createKnowledgeRagEngine(
            process.env,
            credential
          ).indexDocuments(vectorDocuments)
          primaryResult ??= result
          if (result.status === "INDEXED") {
            await this.createAgentAuditEvents(
              {
                action: "knowledge-vector-indexed",
                actor_id: "knowledge-rag-indexer",
                actor_type: "system",
                correlation_id: `${document.document_key}:${document.version}`,
                data: {
                  embedding_provider: credential.provider,
                  indexed_chunks: result.indexed_chunks,
                  provider: result.provider,
                },
                event_type: "agent.knowledge.vector-indexed",
                recorded_at: new Date(),
                resource_id: document.id,
                resource_type: "agent_knowledge_document",
              },
              sharedContext
            )
          }
        } catch (error) {
          lastError = error
        }
      }

      if (!primaryResult) {
        throw lastError ?? new Error("No embedding provider could index knowledge.")
      }
      return primaryResult
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message.slice(0, 1_000)
            : "Knowledge vector indexing failed.",
        indexed_chunks: 0,
        provider: "langchain-qdrant",
        status: "FAILED" as const,
      }
    }
  }

  @InjectManager()
  async reindexGovernedKnowledge(
    tenantId = "default",
    @MedusaContext() sharedContext: Context = {}
  ) {
    const documents = await this.listAgentKnowledgeDocuments(
      { status: "APPROVED", tenant_id: tenantId },
      { take: 10_000 },
      sharedContext
    )
    const eligibleDocuments = documents.filter((document) =>
      isKnowledgeEligible(document)
    )
    if (!eligibleDocuments.length) {
      return {
        indexed_chunks: 0,
        indexed_documents: 0,
        provider: "disabled",
        status: "SKIPPED" as const,
      }
    }
    const chunks = await this.listAgentKnowledgeChunks(
      { document_id: eligibleDocuments.map((document) => document.id) },
      { order: { chunk_index: "ASC" }, take: 50_000 },
      sharedContext
    )
    const documentsById = new Map(
      eligibleDocuments.map((document) => [document.id, document])
    )

    try {
      const credentials = await this.getActiveAiProviderCredentials(
        "embedding",
        tenantId
      )
      if (!credentials.length) {
        const result = await createKnowledgeRagEngine(
          process.env
        ).indexDocuments([])
        return { ...result, indexed_documents: 0 }
      }
      const vectorDocuments = chunks.flatMap((chunk) => {
        const document = documentsById.get(chunk.document_id)
        if (!document) return []
        return [
          {
            checksum: chunk.checksum,
            chunk_id: chunk.id,
            citation_locator: chunk.citation_locator,
            content: chunk.content,
            document_id: document.id,
            document_key: document.document_key,
            locale: document.locale,
            scope: document.scope,
            tenant_id: document.tenant_id,
            title: document.title,
            version: document.version,
          },
        ]
      })
      let primaryResult
      let lastError: unknown
      for (const credential of credentials) {
        try {
          const result = await createKnowledgeRagEngine(
            process.env,
            credential
          ).indexDocuments(vectorDocuments)
          primaryResult ??= result
        } catch (error) {
          lastError = error
        }
      }
      if (!primaryResult) {
        throw lastError ?? new Error("No embedding provider could reindex knowledge.")
      }
      return {
        ...primaryResult,
        indexed_documents: eligibleDocuments.length,
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message.slice(0, 1_000)
            : "Knowledge reindex failed.",
        indexed_chunks: 0,
        indexed_documents: 0,
        provider: "langchain-qdrant",
        status: "FAILED" as const,
      }
    }
  }

  @InjectManager()
  async removeGovernedKnowledgeDocumentIndex(
    documentId: string,
    @MedusaContext() sharedContext: Context = {}
  ) {
    try {
      await this.retrieveAgentKnowledgeDocument(documentId, {}, sharedContext)
      return await deleteKnowledgeDocumentVectors(documentId)
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message.slice(0, 1_000)
            : "Knowledge vector deletion failed.",
        provider: "langchain-qdrant",
        status: "FAILED" as const,
      }
    }
  }

  @InjectManager()
  async searchGovernedKnowledge(
    input: KnowledgeSearchInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<KnowledgeSearchOutput> {
    const parsed = KnowledgeSearchInput.parse(input)
    const filters = {
      locale: parsed.locale,
      scope: parsed.scope,
      status: "APPROVED",
      tenant_id: parsed.tenant_id,
    }
    const documents = await this.listAgentKnowledgeDocuments(
      filters,
      {
        order: { effective_at: "DESC" },
        take: Math.min(Math.max(parsed.limit * 20, 100), 500),
      },
      sharedContext
    )

    if (!documents.length) {
      return { results: [], total_candidates: 0 }
    }

    const knowledgeCacheKey = buildCustomerAssistantCacheKey(
      "knowledge-search",
      {
        documents: documents.map((document) => ({
          id: document.id,
          updated_at: new Date(document.updated_at).toISOString(),
          version: document.version,
        })),
        retrieval_strategy: "topic-aware-v3",
        limit: parsed.limit,
        locale: parsed.locale ?? "",
        query: normalizeCustomerCacheText(parsed.query),
        scope: parsed.scope ?? "",
        tenant_id: parsed.tenant_id,
      }
    )
    const caching = this.getCustomerAssistantCaching()
    const cachedKnowledge = await readCustomerAssistantCache(
      caching,
      knowledgeCacheKey,
      (value) => {
        const result = KnowledgeSearchOutput.safeParse(value)
        return result.success ? result.data : null
      }
    )
    if (cachedKnowledge) {
      return filterKnowledgeEvidenceForQuestion(parsed.query, cachedKnowledge)
    }

    const chunks = await this.listAgentKnowledgeChunks(
      { document_id: documents.map((document) => document.id) },
      { order: { chunk_index: "ASC" }, take: 2_000 },
      sharedContext
    )

    const lexicalOutput = searchKnowledgeChunks(parsed, documents, chunks)
    const relevantLexicalOutput = filterKnowledgeEvidenceForQuestion(
      parsed.query,
      lexicalOutput
    )
    if (!shouldUseSemanticKnowledgeSearch(relevantLexicalOutput)) {
      await writeCustomerAssistantCache(caching, {
        key: knowledgeCacheKey,
        tags: [
          "customer-assistant:knowledge",
          `customer-assistant:tenant:${parsed.tenant_id}`,
        ],
        ttl: CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.knowledge_search,
        value: relevantLexicalOutput,
      })
      return relevantLexicalOutput
    }

    let semanticScores = new Map<string, number>()
    try {
      const credentials = await this.getActiveAiProviderCredentials(
        "embedding",
        parsed.tenant_id
      )
      const eligibleChunkIds = new Set(chunks.map((chunk) => chunk.id))
      for (const credential of credentials) {
        try {
          const results = await createKnowledgeRagEngine(
            process.env,
            credential
          ).search({
            candidate_limit: Math.min(Math.max(parsed.limit * 10, 20), 100),
            locale: parsed.locale,
            query: parsed.query,
            scope: parsed.scope,
            tenant_id: parsed.tenant_id,
          })
          semanticScores = new Map(
            results
              .filter((result) => eligibleChunkIds.has(result.chunk_id))
              .map((result) => [result.chunk_id, result.score])
          )
          if (semanticScores.size) break
        } catch {
          semanticScores = new Map()
        }
      }
    } catch {
      semanticScores = new Map()
    }

    const output = semanticScores.size
      ? searchKnowledgeChunksHybrid(parsed, documents, chunks, semanticScores)
      : searchKnowledgeChunks(parsed, documents, chunks)
    const relevantOutput = filterKnowledgeEvidenceForQuestion(
      parsed.query,
      output
    )
    await writeCustomerAssistantCache(caching, {
      key: knowledgeCacheKey,
      tags: [
        "customer-assistant:knowledge",
        `customer-assistant:tenant:${parsed.tenant_id}`,
      ],
      ttl: CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.knowledge_search,
      value: relevantOutput,
    })
    return relevantOutput
  }

  @InjectManager()
  async draftGovernedKnowledgeAnswer(
    input: {
      conversation_memory?: string
      idempotency_key: string
      knowledge: KnowledgeSearchOutput
      locale: "en" | "vi"
      question: string
      recent_messages?: Array<{ body: string; direction: "INBOUND" | "OUTBOUND" }>
      tenant_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<KnowledgeAnswer> {
    const deliveryTimeGuidance = buildDeliveryTimeGuidanceAnswer(
      input.question,
      input.knowledge,
      input.locale
    )
    if (deliveryTimeGuidance) {
      return {
        ...deliveryTimeGuidance,
        optimization: {
          ai_invoked: false,
          cache_hit: false,
          path: "DETERMINISTIC_DELIVERY_TIME_GUIDANCE",
        },
      }
    }
    const reviewFallback = buildKnowledgeReviewFallback(input.locale)
    const legacyRun = (
      await this.listAgentModelRuns(
        { idempotency_key: input.idempotency_key },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (legacyRun?.status === "SUCCEEDED" && legacyRun.output) {
      const cached = KnowledgeAnswerModelOutput.safeParse(legacyRun.output)
      if (!cached.success) return reviewFallback
      return {
        ...resolveGovernedKnowledgeModelOutput(
          cached.data,
          input.knowledge,
          input.locale
        ),
        optimization: {
          ai_invoked: false,
          cache_hit: true,
          path: "MESSAGE_IDEMPOTENCY",
        },
      }
    }

    const safeInput = {
      approved_knowledge: input.knowledge.results.map((result) => ({
        excerpt: result.excerpt.slice(0, 650),
        locator: result.citation_locator,
        title: result.title,
        version: result.version,
      })),
      locale: input.locale,
      conversation_memory: input.conversation_memory?.slice(-900) ?? "",
      question: input.question.slice(0, 1_000),
      recent_conversation:
        input.recent_messages?.slice(-4).map((m) => ({
          body: m.body.slice(0, 400),
          direction: m.direction,
        })) ?? [],
    }
    let credentials
    try {
      credentials = await this.getActiveAiProviderCredentials(
        "generation",
        input.tenant_id
      )
    } catch {
      if (input.knowledge.results.length > 0) {
        return {
          ...buildKnowledgeAnswerFallback(input.knowledge, input.locale),
          optimization: {
            ai_invoked: false,
            cache_hit: false,
            path: "GROUNDED_KNOWLEDGE_FALLBACK",
          },
        }
      }
      return reviewFallback
    }

    for (const credential of credentials) {
      const adapter = createModelAdapter({
        apiKey: credential.api_key,
        model: credential.model,
        provider: credential.provider,
      })
      const responseCacheKey = buildCustomerAssistantCacheKey(
        "knowledge-answer",
        {
          input: safeInput,
          model: adapter.model,
          prompt_key: KNOWLEDGE_ANSWER_PROMPT_KEY,
          prompt_version: KNOWLEDGE_ANSWER_PROMPT_VERSION,
          provider: adapter.provider,
          tenant_id: input.tenant_id,
        }
      )
      const cachedResponse = await readCustomerAssistantCache(
        this.getCustomerAssistantCaching(),
        responseCacheKey,
        (value) => {
          const result = KnowledgeAnswerModelOutput.safeParse(value)
          return result.success ? result.data : null
        }
      )
      if (cachedResponse) {
        return {
          ...resolveGovernedKnowledgeModelOutput(
            cachedResponse,
            input.knowledge,
            input.locale
          ),
          optimization: {
            ai_invoked: false,
            cache_hit: true,
            path: "AI_RESPONSE_CACHE",
          },
        }
      }
      const attemptKey = `${input.idempotency_key}:provider:${adapter.provider}`
      const existing = (
        await this.listAgentModelRuns(
          { idempotency_key: attemptKey },
          { take: 1 },
          sharedContext
        )
      )[0]
      if (existing?.status === "SUCCEEDED" && existing.output) {
        const cached = KnowledgeAnswerModelOutput.safeParse(existing.output)
        if (cached.success) {
          return resolveGovernedKnowledgeModelOutput(
            cached.data,
            input.knowledge,
            input.locale
          )
        }
      }
      if (existing?.status === "RUNNING") return reviewFallback
      if (existing) continue

      const startedAt = new Date()
      const modelRun = await this.createAgentModelRuns(
        {
          agent_id: "customer-knowledge-agent",
          agent_version: "1.0.0",
          idempotency_key: attemptKey,
          input: redactModelInput(safeInput) as Record<string, unknown>,
          model: adapter.model,
          prompt_key: KNOWLEDGE_ANSWER_PROMPT_KEY,
          prompt_version: KNOWLEDGE_ANSWER_PROMPT_VERSION,
          provider: adapter.provider,
          redacted: true,
          started_at: startedAt,
          status: "RUNNING",
        },
        sharedContext
      )

      try {
        const promptConfig = await this.getPromptConfiguration(
          KNOWLEDGE_ANSWER_PROMPT_KEY,
          sharedContext
        )
        const generated = await adapter.invoke({
          agent_id: "customer-knowledge-agent",
          input: safeInput,
          max_tokens: promptConfig.max_tokens,
          output_schema: KNOWLEDGE_ANSWER_OUTPUT_SCHEMA,
          prompt_key: KNOWLEDGE_ANSWER_PROMPT_KEY,
          prompt_version: promptConfig.version,
          system_prompt: promptConfig.system_prompt,
          timeout_ms: KNOWLEDGE_ANSWER_TIMEOUT_MS,
        })
        const output = KnowledgeAnswerModelOutput.parse(generated)
        await writeCustomerAssistantCache(this.getCustomerAssistantCaching(), {
          key: responseCacheKey,
          tags: [
            "customer-assistant:knowledge-answer",
            `customer-assistant:tenant:${input.tenant_id}`,
          ],
          ttl: CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.knowledge_answer,
          value: output,
        })
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            output,
            status: "SUCCEEDED",
          },
          sharedContext
        )
        return {
          ...resolveGovernedKnowledgeModelOutput(
            output,
            input.knowledge,
            input.locale
          ),
          optimization: {
            ai_invoked: true,
            cache_hit: false,
            path: "AI_MODEL",
          },
        }
      } catch (error) {
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            error:
              error instanceof Error
                ? error.message.slice(0, 1_000)
                : "Customer knowledge answer failed",
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            status: "FAILED",
          },
          sharedContext
        )
      }
    }

    if (input.knowledge.results.length > 0) {
      return {
        ...buildKnowledgeAnswerFallback(input.knowledge, input.locale),
        optimization: {
          ai_invoked: false,
          cache_hit: false,
          path: "GROUNDED_KNOWLEDGE_FALLBACK",
        },
      }
    }

    return reviewFallback
  }

  @InjectManager()
  async draftCustomerProductAdvice(
    input: {
      catalog: CustomerCatalogSnapshot
      conversation_memory?: string
      idempotency_key: string
      locale: "en" | "vi"
      question: string
      recent_messages: Array<{
        body: string
        direction: "INBOUND" | "OUTBOUND"
      }>
      tenant_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<KnowledgeAnswer> {
    const fallbackOutput = buildProductAdvisorFallback(
      input.catalog,
      input.locale,
      input.question
    )
    const fallback = formatProductAdvisorReply(
      fallbackOutput,
      input.catalog,
      input.locale
    )
    const toAnswer = (
      result: { body: string; product_ids: string[] },
      optimization = {
        ai_invoked: false,
        cache_hit: false,
        path: "DETERMINISTIC_FALLBACK",
      }
    ) => {
      const productIds = new Set(result.product_ids)
      const catalogProducts =
        input.catalog.status === "READY" ? input.catalog.products : []
      const productMedia = catalogProducts
        .filter(
          (product) =>
            productIds.has(product.id) && isPublicCustomerUrl(product.thumbnail)
        )
        .slice(0, 3)
        .map((product) => ({
          image_url: product.thumbnail as string,
          product_id: product.id,
          product_url: isPublicCustomerUrl(product.product_url)
            ? product.product_url
            : null,
          title: product.title,
        }))
      return {
        body: result.body,
        citations: [],
        disposition: "ANSWER" as const,
        grounded: input.catalog.status === "READY",
        locale: input.locale,
        optimization,
        product_ids: result.product_ids,
        product_media: productMedia,
      }
    }
    if (
      input.catalog.status === "UNAVAILABLE" ||
      !input.catalog.products.length
    ) {
      return toAnswer(fallback)
    }
    if (isCatalogOverviewRequest(input.question)) {
      return toAnswer(buildCatalogOverviewReply(input.catalog, input.locale, input.question), {
        ai_invoked: false,
        cache_hit: false,
        path: "DETERMINISTIC_CATALOG",
      })
    }

    const legacyRun = (
      await this.listAgentModelRuns(
        { idempotency_key: input.idempotency_key },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (legacyRun?.status === "SUCCEEDED" && legacyRun.output) {
      const cached = ProductAdvisorModelOutput.safeParse(legacyRun.output)
      if (cached.success) {
        return toAnswer(
          resolveProductAdvisorModelOutput(
            cached.data,
            input.catalog,
            input.locale,
            input.question
          ),
          {
            ai_invoked: false,
            cache_hit: true,
            path: "MESSAGE_IDEMPOTENCY",
          }
        )
      }
    }

    const safeInput = {
      catalog: input.catalog.products.map((product) => ({
        category_names: product.category_names,
        collection_title: product.collection_title,
        description: product.description?.slice(0, 420) ?? null,
        id: product.id,
        subtitle: product.subtitle,
        title: product.title,
        variants: product.variants.map((variant) => ({
          availability: variant.availability,
          available_quantity: variant.available_quantity,
          currency_code: variant.currency_code,
          id: variant.id,
          price: variant.price,
          title: variant.title,
        })),
      })),
      conversation_memory: input.conversation_memory?.slice(-900) ?? "",
      current_message: input.question.slice(0, 1_000),
      locale: input.locale,
      recent_conversation: input.recent_messages.slice(-4).map((message) => ({
        body: message.body.slice(0, 400),
        direction: message.direction,
      })),
      shopping_preferences: extractCustomerProductPreferences(input.question),
    }
    let credentials
    try {
      credentials = await this.getActiveAiProviderCredentials(
        "generation",
        input.tenant_id
      )
    } catch {
      return toAnswer(fallback)
    }

    for (const credential of credentials) {
      const adapter = createModelAdapter({
        apiKey: credential.api_key,
        model: credential.model,
        provider: credential.provider,
      })
      const responseCacheKey = buildCustomerAssistantCacheKey(
        "product-advice",
        {
          input: safeInput,
          model: adapter.model,
          prompt_key: PRODUCT_ADVISOR_PROMPT_KEY,
          prompt_version: PRODUCT_ADVISOR_PROMPT_VERSION,
          provider: adapter.provider,
          tenant_id: input.tenant_id,
        }
      )
      const cachedResponse = await readCustomerAssistantCache(
        this.getCustomerAssistantCaching(),
        responseCacheKey,
        (value) => {
          const result = ProductAdvisorModelOutput.safeParse(value)
          return result.success ? result.data : null
        }
      )
      if (cachedResponse) {
        return toAnswer(
          resolveProductAdvisorModelOutput(
            cachedResponse,
            input.catalog,
            input.locale,
            input.question
          ),
          {
            ai_invoked: false,
            cache_hit: true,
            path: "AI_RESPONSE_CACHE",
          }
        )
      }
      const attemptKey = `${input.idempotency_key}:provider:${adapter.provider}`
      const existing = (
        await this.listAgentModelRuns(
          { idempotency_key: attemptKey },
          { take: 1 },
          sharedContext
        )
      )[0]
      if (existing?.status === "SUCCEEDED" && existing.output) {
        const cached = ProductAdvisorModelOutput.safeParse(existing.output)
        if (cached.success) {
          return toAnswer(
            resolveProductAdvisorModelOutput(
              cached.data,
              input.catalog,
              input.locale,
              input.question
            )
          )
        }
      }
      if (existing?.status === "RUNNING") return toAnswer(fallback)
      if (existing) continue

      const startedAt = new Date()
      const modelRun = await this.createAgentModelRuns(
        {
          agent_id: "customer-product-advisor",
          agent_version: "1.0.0",
          idempotency_key: attemptKey,
          input: redactModelInput(safeInput) as Record<string, unknown>,
          model: adapter.model,
          prompt_key: PRODUCT_ADVISOR_PROMPT_KEY,
          prompt_version: PRODUCT_ADVISOR_PROMPT_VERSION,
          provider: adapter.provider,
          redacted: true,
          started_at: startedAt,
          status: "RUNNING",
        },
        sharedContext
      )
      try {
        const promptConfig = await this.getPromptConfiguration(
          PRODUCT_ADVISOR_PROMPT_KEY,
          sharedContext
        )
        const generated = await adapter.invoke({
          agent_id: "customer-product-advisor",
          input: safeInput,
          max_tokens: promptConfig.max_tokens,
          output_schema: PRODUCT_ADVISOR_OUTPUT_SCHEMA,
          prompt_key: PRODUCT_ADVISOR_PROMPT_KEY,
          prompt_version: promptConfig.version,
          system_prompt: promptConfig.system_prompt,
          timeout_ms: PRODUCT_ADVISOR_TIMEOUT_MS,
        })
        const output = ProductAdvisorModelOutput.parse(generated)
        await writeCustomerAssistantCache(this.getCustomerAssistantCaching(), {
          key: responseCacheKey,
          tags: [
            "customer-assistant:product-advice",
            `customer-assistant:tenant:${input.tenant_id}`,
          ],
          ttl: CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.product_advice,
          value: output,
        })
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            output,
            status: "SUCCEEDED",
          },
          sharedContext
        )
        return toAnswer(
          resolveProductAdvisorModelOutput(
            output,
            input.catalog,
            input.locale,
            input.question
          ),
          {
            ai_invoked: true,
            cache_hit: false,
            path: "AI_MODEL",
          }
        )
      } catch (error) {
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            error:
              error instanceof Error
                ? error.message.slice(0, 1_000)
                : "Customer product advice failed",
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            status: "FAILED",
          },
          sharedContext
        )
      }
    }

    return toAnswer(fallback)
  }

  @InjectManager()
  async classifyCustomerMessageIntent(
    input: {
      conversation_memory?: string
      idempotency_key: string
      locale: "en" | "vi"
      message: string
      recent_messages: Array<{
        body: string
        direction: "INBOUND" | "OUTBOUND"
      }>
      tenant_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CustomerMessageIntentResult> {
    const fallback = defaultCustomerMessageIntent()
    const legacyRun = (
      await this.listAgentModelRuns(
        { idempotency_key: input.idempotency_key },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (legacyRun?.status === "SUCCEEDED" && legacyRun.output) {
      const cached = CustomerMessageIntentModelOutput.safeParse(legacyRun.output)
      return cached.success ? cached.data : fallback
    }

    const safeInput = {
      conversation_memory: input.conversation_memory?.slice(-800) ?? "",
      current_message: input.message.slice(0, 800),
      locale: input.locale,
      recent_conversation: input.recent_messages.slice(-3).map((message) => ({
        body: message.body.slice(0, 320),
        direction: message.direction,
      })),
    }
    let credentials
    try {
      credentials = await this.getActiveAiProviderCredentials(
        "generation",
        input.tenant_id
      )
    } catch {
      return fallback
    }

    for (const credential of credentials) {
      const adapter = createModelAdapter({
        apiKey: credential.api_key,
        model: credential.model,
        provider: credential.provider,
      })
      const intentCacheKey = buildCustomerAssistantCacheKey("intent", {
        input: safeInput,
        model: adapter.model,
        prompt_key: CUSTOMER_MESSAGE_INTENT_PROMPT_KEY,
        prompt_version: CUSTOMER_MESSAGE_INTENT_PROMPT_VERSION,
        provider: adapter.provider,
        tenant_id: input.tenant_id,
      })
      const cachedIntent = await readCustomerAssistantCache(
        this.getCustomerAssistantCaching(),
        intentCacheKey,
        (value) => {
          const result = CustomerMessageIntentModelOutput.safeParse(value)
          return result.success ? result.data : null
        }
      )
      if (cachedIntent) return cachedIntent
      const attemptKey = `${input.idempotency_key}:provider:${adapter.provider}`
      const existing = (
        await this.listAgentModelRuns(
          { idempotency_key: attemptKey },
          { take: 1 },
          sharedContext
        )
      )[0]
      if (existing?.status === "SUCCEEDED" && existing.output) {
        const cached = CustomerMessageIntentModelOutput.safeParse(
          existing.output
        )
        if (cached.success) return cached.data
      }
      if (existing?.status === "RUNNING") return fallback
      if (existing) continue

      const startedAt = new Date()
      const modelRun = await this.createAgentModelRuns(
        {
          agent_id: "customer-intent-router",
          agent_version: "1.0.0",
          idempotency_key: attemptKey,
          input: redactModelInput(safeInput) as Record<string, unknown>,
          model: adapter.model,
          prompt_key: CUSTOMER_MESSAGE_INTENT_PROMPT_KEY,
          prompt_version: CUSTOMER_MESSAGE_INTENT_PROMPT_VERSION,
          provider: adapter.provider,
          redacted: true,
          started_at: startedAt,
          status: "RUNNING",
        },
        sharedContext
      )

      try {
        const promptConfig = await this.getPromptConfiguration(
          CUSTOMER_MESSAGE_INTENT_PROMPT_KEY,
          sharedContext
        )
        const generated = await adapter.invoke({
          agent_id: "customer-intent-router",
          input: safeInput,
          max_tokens: promptConfig.max_tokens,
          output_schema: CUSTOMER_MESSAGE_INTENT_OUTPUT_SCHEMA,
          prompt_key: CUSTOMER_MESSAGE_INTENT_PROMPT_KEY,
          prompt_version: promptConfig.version,
          system_prompt: promptConfig.system_prompt,
          timeout_ms: CUSTOMER_MESSAGE_INTENT_TIMEOUT_MS,
        })
        const output = CustomerMessageIntentModelOutput.parse(generated)
        await writeCustomerAssistantCache(this.getCustomerAssistantCaching(), {
          key: intentCacheKey,
          tags: [
            "customer-assistant:intent",
            `customer-assistant:tenant:${input.tenant_id}`,
          ],
          ttl: CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.intent,
          value: output,
        })
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            output,
            status: "SUCCEEDED",
          },
          sharedContext
        )
        return output
      } catch (error) {
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            error:
              error instanceof Error
                ? error.message.slice(0, 1_000)
                : "Customer intent classification failed",
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            status: "FAILED",
          },
          sharedContext
        )
      }
    }

    return fallback
  }

  @InjectManager()
  async draftCustomerConversationReply(
    input: {
      conversation_memory?: string
      fallback_body: string
      idempotency_key: string
      intent: CustomerConversationIntent
      locale: "en" | "vi"
      message: string
      recent_messages: Array<{
        body: string
        direction: "INBOUND" | "OUTBOUND"
      }>
      tenant_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<KnowledgeAnswer> {
    const fallback = (optimization = {
      ai_invoked: false,
      cache_hit: false,
      path: "DETERMINISTIC_FALLBACK",
    }): KnowledgeAnswer => ({
      body: input.fallback_body,
      citations: [],
      disposition: input.intent,
      grounded: false,
      locale: input.locale,
      optimization,
    })
    const toAnswer = (
      output: CustomerConversationModelResult,
      optimization: NonNullable<KnowledgeAnswer["optimization"]>
    ): KnowledgeAnswer =>
      isSafeCustomerConversationBody(output.body)
        ? {
            body: output.body,
            citations: [],
            disposition: input.intent,
            grounded: false,
            locale: input.locale,
            optimization,
          }
        : fallback()

    const legacyRun = (
      await this.listAgentModelRuns(
        { idempotency_key: input.idempotency_key },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (legacyRun?.status === "SUCCEEDED" && legacyRun.output) {
      const cached = CustomerConversationModelOutput.safeParse(legacyRun.output)
      return cached.success
        ? toAnswer(cached.data, {
            ai_invoked: false,
            cache_hit: true,
            path: "MESSAGE_IDEMPOTENCY",
          })
        : fallback()
    }

    const safeInput = {
      compact_memory: input.conversation_memory?.slice(-800) ?? "",
      current_message: input.message.slice(0, 800),
      intent: input.intent,
      locale: input.locale,
      recent_conversation: input.recent_messages.slice(-4).map((message) => ({
        body: message.body.slice(0, 320),
        direction: message.direction,
      })),
    }
    let credentials
    try {
      credentials = await this.getActiveAiProviderCredentials(
        "generation",
        input.tenant_id
      )
    } catch {
      return fallback()
    }

    for (const credential of credentials) {
      const adapter = createModelAdapter({
        apiKey: credential.api_key,
        model: credential.model,
        provider: credential.provider,
      })
      const responseCacheKey = buildCustomerAssistantCacheKey(
        "conversation-reply",
        {
          input: safeInput,
          model: adapter.model,
          prompt_key: CUSTOMER_CONVERSATION_PROMPT_KEY,
          prompt_version: CUSTOMER_CONVERSATION_PROMPT_VERSION,
          provider: adapter.provider,
          tenant_id: input.tenant_id,
        }
      )
      const cachedResponse = await readCustomerAssistantCache(
        this.getCustomerAssistantCaching(),
        responseCacheKey,
        (value) => {
          const result = CustomerConversationModelOutput.safeParse(value)
          return result.success && isSafeCustomerConversationBody(result.data.body)
            ? result.data
            : null
        }
      )
      if (cachedResponse) {
        return toAnswer(cachedResponse, {
          ai_invoked: false,
          cache_hit: true,
          path: "AI_RESPONSE_CACHE",
        })
      }

      const attemptKey = `${input.idempotency_key}:provider:${adapter.provider}`
      const existing = (
        await this.listAgentModelRuns(
          { idempotency_key: attemptKey },
          { take: 1 },
          sharedContext
        )
      )[0]
      if (existing?.status === "SUCCEEDED" && existing.output) {
        const cached = CustomerConversationModelOutput.safeParse(existing.output)
        if (cached.success) {
          return toAnswer(cached.data, {
            ai_invoked: false,
            cache_hit: true,
            path: "MESSAGE_IDEMPOTENCY",
          })
        }
      }
      if (existing?.status === "RUNNING") return fallback()
      if (existing) continue

      const startedAt = new Date()
      const modelRun = await this.createAgentModelRuns(
        {
          agent_id: "customer-conversation-agent",
          agent_version: "1.0.0",
          idempotency_key: attemptKey,
          input: redactModelInput(safeInput) as Record<string, unknown>,
          model: adapter.model,
          prompt_key: CUSTOMER_CONVERSATION_PROMPT_KEY,
          prompt_version: CUSTOMER_CONVERSATION_PROMPT_VERSION,
          provider: adapter.provider,
          redacted: true,
          started_at: startedAt,
          status: "RUNNING",
        },
        sharedContext
      )

      try {
        const promptConfig = await this.getPromptConfiguration(
          CUSTOMER_CONVERSATION_PROMPT_KEY,
          sharedContext
        )
        const generated = await adapter.invoke({
          agent_id: "customer-conversation-agent",
          input: safeInput,
          max_tokens: promptConfig.max_tokens,
          output_schema: CUSTOMER_CONVERSATION_OUTPUT_SCHEMA,
          prompt_key: CUSTOMER_CONVERSATION_PROMPT_KEY,
          prompt_version: promptConfig.version,
          system_prompt: promptConfig.system_prompt,
          timeout_ms: CUSTOMER_CONVERSATION_TIMEOUT_MS,
        })
        const output = CustomerConversationModelOutput.parse(generated)
        if (!isSafeCustomerConversationBody(output.body)) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Customer conversation reply failed safety validation."
          )
        }
        await writeCustomerAssistantCache(this.getCustomerAssistantCaching(), {
          key: responseCacheKey,
          tags: [
            "customer-assistant:conversation-reply",
            `customer-assistant:tenant:${input.tenant_id}`,
          ],
          ttl: CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.conversation_reply,
          value: output,
        })
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            output,
            status: "SUCCEEDED",
          },
          sharedContext
        )
        return toAnswer(output, {
          ai_invoked: true,
          cache_hit: false,
          path: "AI_MODEL",
        })
      } catch (error) {
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            error:
              error instanceof Error
                ? error.message.slice(0, 1_000)
                : "Customer conversation reply failed",
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            status: "FAILED",
          },
          sharedContext
        )
      }
    }

    return fallback()
  }

  @InjectManager()
  async analyzeCustomerSupportImages(
    input: {
      caption: string
      image_urls: string[]
      inbound_message_id: string
      tenant_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<VisionDefectAnalysisOutput | null> {
    const imageUrls = input.image_urls.filter((value) => {
      try {
        const url = new URL(value)
        return url.protocol === "https:" && !url.username && !url.password
      } catch {
        return false
      }
    })
    if (!imageUrls.length) return null

    const idempotencyKey = `customer-vision:${input.inbound_message_id}`
    const existingRuns = await this.listAgentModelRuns(
      { idempotency_key: idempotencyKey },
      { take: 1 },
      sharedContext
    )
    const existing = existingRuns[0]
    if (existing?.status === "SUCCEEDED" && existing.output) {
      const parsed = VisionDefectAnalysisOutput.safeParse(existing.output)
      return parsed.success ? parsed.data : null
    }
    if (existing) return null

    let credentials
    try {
      credentials = await this.getActiveAiProviderCredentials(
        "generation",
        input.tenant_id
      )
    } catch {
      return null
    }
    const credential = credentials.find(
      (candidate) =>
        candidate.provider === "gemini" || candidate.provider === "openai"
    )
    if (!credential) return null

    const prompt = await this.getPromptConfiguration(
      CUSTOMER_VISION_PROMPT_KEY,
      sharedContext
    )
    const adapter = createModelAdapter({
      apiKey: credential.api_key,
      model: credential.model,
      provider: credential.provider,
    })
    const safeInput = {
      customer_caption: input.caption.slice(0, 1_000),
      image_count: imageUrls.length,
      task: "Assess only visible product-defect evidence for human support review.",
    }
    const modelRun = await this.createAgentModelRuns(
      {
        agent_id: "customer-vision-review-agent",
        agent_version: "1.0.0",
        idempotency_key: idempotencyKey,
        input: redactModelInput(safeInput) as Record<string, unknown>,
        model: adapter.model,
        prompt_key: prompt.prompt_key,
        prompt_version: prompt.version,
        provider: adapter.provider,
        redacted: true,
        started_at: new Date(),
        status: "RUNNING",
      },
      sharedContext
    )
    const startedAt = Date.now()
    try {
      const generated = await adapter.invoke({
        agent_id: "customer-vision-review-agent",
        image_urls: imageUrls,
        input: safeInput,
        max_tokens: prompt.max_tokens,
        output_schema: CUSTOMER_VISION_OUTPUT_SCHEMA,
        prompt_key: prompt.prompt_key,
        prompt_version: prompt.version,
        system_prompt: prompt.system_prompt || CUSTOMER_VISION_SYSTEM_PROMPT,
        timeout_ms: CUSTOMER_VISION_TIMEOUT_MS,
      })
      const output = VisionDefectAnalysisOutput.parse(generated)
      await this.updateAgentModelRuns(
        {
          completed_at: new Date(),
          id: modelRun.id,
          latency_ms: Date.now() - startedAt,
          output,
          status: "SUCCEEDED",
        },
        sharedContext
      )
      return output
    } catch (error) {
      await this.updateAgentModelRuns(
        {
          completed_at: new Date(),
          error:
            error instanceof Error
              ? error.message.slice(0, 1_000)
              : "Customer image analysis failed",
          id: modelRun.id,
          latency_ms: Date.now() - startedAt,
          status: "FAILED",
        },
        sharedContext
      )
      return null
    }
  }

  @InjectManager()
  async processCustomerKnowledgeQuestion(
    input: ProcessCustomerKnowledgeQuestionInput & {
      catalog_snapshot?: CustomerCatalogSnapshot
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const inbound = await this.retrieveAgentMessage(
      input.inbound_message_id,
      {},
      sharedContext
    )
    if (
      inbound.direction !== "INBOUND" ||
      inbound.message_type !== "TEXT"
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Message ${inbound.id} is not a customer knowledge question.`
      )
    }

    const responseIdempotencyKey = `customer-answer:${inbound.id}`
    const existing = (
      await this.listAgentMessages(
        { idempotency_key: responseIdempotencyKey },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (existing) {
      let delivery = (
        await this.listAgentDeliveries(
          { message_id: existing.id },
          { take: 1 },
          sharedContext
        )
      )[0]
      if (!delivery) {
        const existingConversation = await this.retrieveAgentConversation(
          existing.conversation_id,
          {},
          sharedContext
        )
        const existingMetadata = (existingConversation.metadata ??
          {}) as Record<string, unknown>
        if (typeof existingMetadata.connection_id === "string") {
          delivery = await this.createAgentDeliveries(
            {
              attempt_count: 0,
              available_at: new Date(),
              channel: existingConversation.channel,
              connection_id: existingMetadata.connection_id,
              idempotency_key: `message:${existing.id}:delivery`,
              message_id: existing.id,
              status: "PENDING",
            },
            sharedContext
          )
        }
      }
      return {
        delivery_id: delivery?.id ?? null,
        duplicate: true,
        grounded: Boolean(
          (existing.structured_content as Record<string, unknown> | null)
            ?.grounded
        ),
        response_message_id: existing.id,
      }
    }

    const existingEscalation = (
      await this.listAgentTasks(
        {
          idempotency_key: `customer-knowledge-escalation:${inbound.id}`,
        },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (existingEscalation) {
      return {
        delivery_id: null,
        duplicate: true,
        grounded: false,
        response_message_id: null,
        support_task_id: existingEscalation.id,
      }
    }

    const conversation = await this.retrieveAgentConversation(
      inbound.conversation_id,
      {},
      sharedContext
    )
    const metadata = (conversation.metadata ?? {}) as Record<string, unknown>
    if (metadata.ai_paused === true) {
      return {
        ai_paused: true,
        delivery_id: null,
        duplicate: false,
        grounded: false,
        response_message_id: null,
        support_task_id: null,
      }
    }
    if (!isCustomerSupportConversation({
      metadata,
      topic_type: conversation.topic_type,
    })) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Conversation ${conversation.id} is not authorized for customer knowledge answers.`
      )
    }
    const connectionId =
      typeof metadata.connection_id === "string" ? metadata.connection_id : null
    if (!connectionId || conversation.status !== "OPEN") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Customer conversation ${conversation.id} cannot deliver a response.`
      )
    }
    const connection = await this.retrieveAgentChannelConnection(
      connectionId,
      {},
      sharedContext
    )
    if (
      connection.channel !== conversation.channel ||
      connection.status !== "ACTIVE"
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Channel connection ${connection.id} is inactive or mismatched.`
      )
    }

    const question = inbound.body.trim()
    const referencesPriorContext = hasExplicitHistoricalCustomerReference(question)
    const startsNewTopic = startsExplicitNewProductTopic(question)
    const [conversationMemory, customerProfilePreferences] = await Promise.all([
      this.listAgentConversationMemories(
        { conversation_id: conversation.id },
        { take: 1 },
        sharedContext
      ).then((memories) => memories[0]),
      referencesPriorContext
        ? this.listAgentCustomerPreferences(
            {
              customer_id: inbound.sender_id,
              tenant_id: conversation.tenant_id,
            },
            { order: { last_confirmed_at: "DESC" }, take: 12 },
            sharedContext
          )
        : Promise.resolve([]),
    ])
    await this.recordExplicitCustomerPreferences(
      {
        conversation_id: conversation.id,
        customer_id: inbound.sender_id,
        message: question,
        message_id: inbound.id,
        tenant_id: conversation.tenant_id,
      },
      sharedContext
    )
    const profileContextNow = new Date()
    const activeProfilePreferences = customerProfilePreferences.filter(
      (preference) =>
        new Date(preference.expires_at).getTime() > profileContextNow.getTime()
    )
    const memorySummary = buildCustomerConversationContext({
      current_message_at: inbound.occurred_at,
      current_summary: startsNewTopic ? null : conversationMemory?.summary,
      customer_facts: readMemoryItems(conversationMemory?.customer_facts),
      last_message_at: conversation.last_message_at,
      open_questions: readMemoryItems(conversationMemory?.open_questions),
      profile_preferences: referencesPriorContext
        ? formatCustomerProfilePreferences(activeProfilePreferences)
        : [],
      resolved_topics: readMemoryItems(conversationMemory?.resolved_topics),
    })

    const explicitAttack = isExplicitPromptAttack(question)
    const recentMessages = explicitAttack
      ? []
      : await this.listAgentMessages(
          { conversation_id: conversation.id },
          { order: { occurred_at: "DESC" }, take: 7 },
          sharedContext
        )
    const contextMessages = startsNewTopic ? [] : recentMessages
    const mapRecentMessagesWithTime = (
      messages: typeof contextMessages,
      excludeInboundId?: string
    ) => {
      return messages
        .slice()
        .reverse()
        .filter(
          (message) =>
            (!excludeInboundId || message.id !== excludeInboundId) &&
            (message.direction === "INBOUND" || message.direction === "OUTBOUND")
        )
        .map((message) => {
          const relativeTime = formatRelativeTime(
            message.occurred_at,
            inbound.occurred_at
          )
          return {
            body: `[${relativeTime}] ${message.body}`,
            direction: message.direction as "INBOUND" | "OUTBOUND",
          }
        })
    }
    const locale =
      input.customer_order_lookup_locale ??
      resolveCustomerConversationLocale(question, recentMessages)

    if (input.customer_order_lookup) {
      const answer = buildCustomerOrderLookupReply(
        input.customer_order_lookup,
        locale
      )
      const now = new Date()
      const response = await this.createAgentMessages(
        {
          body: formatChannelKnowledgeAnswer(answer),
          channel: conversation.channel,
          conversation_id: conversation.id,
          direction: "OUTBOUND",
          idempotency_key: responseIdempotencyKey,
          message_type: "TEXT",
          occurred_at: now,
          sender_id: "customer-knowledge-agent",
          sender_type: "agent",
          status: "AVAILABLE",
          structured_content: {
            citations: [],
            disposition: answer.disposition,
            grounded: answer.grounded,
            grounding_source:
              input.customer_order_lookup.status === "FOUND"
                ? "LIVE_ORDER"
                : "CONVERSATION",
            inbound_message_id: inbound.id,
            intent: "STORE_QUESTION",
            intent_confidence: 1,
            live_order: answer.live_order ?? null,
            locale,
            optimization: {
              ai_invoked: false,
              cache_hit: false,
              path: "VERIFIED_CUSTOMER_ORDER_LOOKUP",
            },
            product_ids: [],
            product_media: [],
          },
        },
        sharedContext
      )
      const delivery = await this.createAgentDeliveries(
        {
          attempt_count: 0,
          available_at: now,
          channel: conversation.channel,
          connection_id: connection.id,
          idempotency_key: `message:${response.id}:delivery`,
          message_id: response.id,
          status: "PENDING",
        },
        sharedContext
      )
      await this.updateAgentConversations(
        { id: conversation.id, last_message_at: now },
        sharedContext
      )
      this.broadcastMessageCreated(response)
      this.broadcastConversationUpdated({
        channel: conversation.channel,
        id: conversation.id,
        last_message_at: now,
        title: conversation.title,
      })
      await this.createAgentAuditEvents(
        {
          action: "customer-order-lookup-response-created",
          actor_id: "customer-knowledge-agent",
          actor_type: "agent",
          correlation_id:
            `${conversation.channel.toLowerCase()}:${connection.id}:${inbound.id}`,
          data: {
            display_id: input.customer_order_lookup.display_id,
            lookup_status: input.customer_order_lookup.status,
            response_message_id: response.id,
          },
          event_type: "agent.customer-order.lookup-response-created",
          recorded_at: now,
          resource_id: response.id,
          resource_type: "agent_message",
        },
        sharedContext
      )
      return {
        delivery_id: delivery.id,
        duplicate: false,
        grounded: answer.grounded,
        response_message_id: response.id,
        support_task_id: null,
      }
    }
    const settings = await this.getAssistantSettings(sharedContext)
    const smallTalk = explicitAttack
      ? null
      : buildCustomerSmallTalkReply(question, locale, settings)
    const intent = explicitAttack
      ? {
          confidence: 1,
          intent: "UNSAFE" as const,
          reason: "Matched a backend security rule.",
        }
      : await this.classifyCustomerMessageIntent(
          {
            conversation_memory: memorySummary,
            idempotency_key: `customer-intent-model:${inbound.id}`,
            locale,
            message: question,
            recent_messages: mapRecentMessagesWithTime(contextMessages),
            tenant_id: conversation.tenant_id,
          },
          sharedContext
        )
    const routedIntent = resolveCustomerMessageIntent(intent)
    const sentiment = analyzeCustomerSentiment(question)
    let reviewRouted = false
    let supportTaskId: string | null = null
    let toolTrace: Array<Record<string, unknown>> = []
    const recordKnowledgeSearchTool = async (
      query: string,
      knowledge: KnowledgeSearchOutput
    ) => {
      const output = {
        document_ids: knowledge.results.map((result) => result.document_id),
        result_count: knowledge.results.length,
        total_candidates: knowledge.total_candidates,
      }
      await this.recordCustomerReadToolCall(
        {
          conversation_id: conversation.id,
          inbound_message_id: inbound.id,
          input: {
            locale,
            query: query.slice(0, 500),
            scope: "customer_support",
          },
          output,
          tool_name: "knowledge.search",
          tool_version: "1.0.0",
        },
        sharedContext
      )
      toolTrace.push({
        input: { query: query.slice(0, 500), scope: "customer_support" },
        output,
        tool_name: "knowledge.search",
      })
    }
    let answer: KnowledgeAnswer
    if (sentiment.needs_immediate_escalation) {
      const escalation = await this.createCustomerKnowledgeEscalation(
        {
          conversation_id: conversation.id,
          inbound_message_id: inbound.id,
          locale,
          question,
          reason: "CUSTOMER_DISTRESS",
        },
        sharedContext
      )
      reviewRouted = true
      supportTaskId = escalation.task?.id ?? null
      answer = {
        body:
          sentiment.empathetic_response ??
          buildCustomerReviewAcknowledgement(
            locale,
            "NEEDS_STAFF_AUTHORITY",
            locale === "vi"
              ? settings.review_ack_message_vi
              : settings.review_ack_message_en
          ).body,
        citations: [],
        disposition: "ANSWER",
        grounded: false,
        locale,
        optimization: {
          ai_invoked: false,
          cache_hit: false,
          path: "SENTIMENT_CRITICAL_HANDOFF",
        },
      }
    } else if (routedIntent === "HUMAN_ACTION") {
      const escalation = await this.createCustomerKnowledgeEscalation(
        {
          conversation_id: conversation.id,
          inbound_message_id: inbound.id,
          locale,
          question,
          reason: "NEEDS_STAFF_AUTHORITY",
        },
        sharedContext
      )
      reviewRouted = true
      supportTaskId = escalation.task?.id ?? null
      answer = buildCustomerReviewAcknowledgement(
        locale,
        "NEEDS_STAFF_AUTHORITY",
        locale === "vi"
          ? settings.review_ack_message_vi
          : settings.review_ack_message_en
      )
    } else if (routedIntent === "SMALL_TALK" || routedIntent === "CLARIFY") {
      answer = await this.draftCustomerConversationReply(
        {
          conversation_memory: memorySummary,
          fallback_body:
            smallTalk?.body ??
            buildCustomerIntentReply(
              routedIntent,
              locale,
              isCustomerAddressingShop(question),
              settings
            ),
          idempotency_key: `customer-conversation-response:${inbound.id}`,
          intent: routedIntent,
          locale,
          message: question,
          recent_messages: mapRecentMessagesWithTime(
            contextMessages,
            inbound.id
          ),
          tenant_id: conversation.tenant_id,
        },
        sharedContext
      )
    } else if (routedIntent === "PRODUCT_DISCOVERY") {
      const catalog = input.catalog_snapshot ?? {
        products: [] as [],
        query: question,
        status: "UNAVAILABLE" as const,
        total_count: 0 as const,
      }
      const toolLoop = runCustomerSupportReadToolLoop({
        catalog,
        question,
      })
      toolTrace = toolLoop.trace
      const productAnswer = await this.draftCustomerProductAdvice(
        {
          catalog: toolLoop.catalog,
          conversation_memory: memorySummary,
          idempotency_key: `customer-product-advisor:${inbound.id}`,
          locale,
          question,
          recent_messages: mapRecentMessagesWithTime(contextMessages),
          tenant_id: conversation.tenant_id,
        },
        sharedContext
      )
      const hybridKind = detectHybridIntent(question, toolLoop.catalog)
      if (
        (hybridKind === "PRODUCT_AND_SHIPPING" ||
          hybridKind === "PRODUCT_AND_POLICY") &&
        question.length >= 4
      ) {
        const retrievedKnowledge = await this.searchGovernedKnowledge(
          {
            limit: 3,
            locale,
            query: question.slice(0, 500),
            scope: "customer_support",
            tenant_id: conversation.tenant_id,
          },
          sharedContext
        )
        await recordKnowledgeSearchTool(question, retrievedKnowledge)
        const relevantKnowledge = filterKnowledgeEvidenceForQuestion(
          question,
          retrievedKnowledge
        )
        if (hasSufficientKnowledgeEvidence(relevantKnowledge)) {
          const knowledgeSubAnswer = await this.draftGovernedKnowledgeAnswer(
            {
              conversation_memory: memorySummary,
              idempotency_key: `customer-hybrid-knowledge:${inbound.id}`,
              knowledge: relevantKnowledge,
              locale,
              question,
              recent_messages: mapRecentMessagesWithTime(
                contextMessages,
                inbound.id
              ),
              tenant_id: conversation.tenant_id,
            },
            sharedContext
          )
          answer = synthesizeHybridAnswer(
            { locale, question },
            productAnswer,
            knowledgeSubAnswer
          )
        } else {
          answer = productAnswer
        }
      } else {
        answer = productAnswer
      }
    } else if (routedIntent === "OUT_OF_SCOPE" || routedIntent === "UNSAFE") {
      answer = buildScopedCustomerReply(routedIntent, locale)
    } else {
      const recentInboundBodies = contextMessages
        .filter((m) => m.direction === "INBOUND" && m.id !== inbound.id)
        .slice(0, 2)
        .map((m) => m.body)
        .join(" ")
      const contextualContext = [recentInboundBodies, memorySummary]
        .filter(Boolean)
        .join(" ")
      const contextualQuery =
        isContextDependentKnowledgeQuestion(question) && contextualContext
          ? `${contextualContext} ${question}`
          : question
      const retrievedKnowledge =
        question.length >= 2
          ? await this.searchGovernedKnowledge(
              {
                limit: 5,
                locale,
                query: contextualQuery.slice(0, 500),
                scope: "customer_support",
                tenant_id: conversation.tenant_id,
              },
              sharedContext
            )
          : { results: [], total_candidates: 0 }
      if (question.length >= 2) {
        await recordKnowledgeSearchTool(contextualQuery, retrievedKnowledge)
      }
      const relevantKnowledge = filterKnowledgeEvidenceForQuestion(
        contextualQuery,
        retrievedKnowledge
      )
      const knowledge = hasSufficientKnowledgeEvidence(relevantKnowledge)
        ? relevantKnowledge
        : { results: [], total_candidates: relevantKnowledge.total_candidates }
      answer = await this.draftGovernedKnowledgeAnswer(
        {
          conversation_memory: memorySummary,
          idempotency_key: `customer-answer-model:${inbound.id}`,
          knowledge,
          locale,
          question,
          recent_messages: mapRecentMessagesWithTime(
            contextMessages,
            inbound.id
          ),
          tenant_id: conversation.tenant_id,
        },
        sharedContext
      )
    }
    if (answer.disposition === "HUMAN_REVIEW" && !reviewRouted) {
      const escalation = await this.createCustomerKnowledgeEscalation(
        {
          conversation_id: conversation.id,
          inbound_message_id: inbound.id,
          locale,
          question,
          reason: "NO_APPROVED_KNOWLEDGE",
        },
        sharedContext
      )
      supportTaskId = escalation.task?.id ?? null
      answer = buildCustomerReviewAcknowledgement(
        locale,
        "NO_APPROVED_KNOWLEDGE",
        locale === "vi"
          ? settings.review_ack_message_vi
          : settings.review_ack_message_en
      )
    }

    const now = new Date()
    const response = await this.createAgentMessages(
      {
        body: formatChannelKnowledgeAnswer(answer),
        channel: conversation.channel,
        conversation_id: conversation.id,
        direction: "OUTBOUND",
        idempotency_key: responseIdempotencyKey,
        message_type: "TEXT",
        occurred_at: now,
        sender_id: "customer-knowledge-agent",
        sender_type: "agent",
        status: "AVAILABLE",
        structured_content: {
          citations: answer.citations,
          grounded: answer.grounded,
          disposition: answer.disposition,
          inbound_message_id: inbound.id,
          intent: routedIntent,
          intent_confidence: intent.confidence,
          locale,
          sentiment: sentiment.sentiment,
          sentiment_urgency: sentiment.urgency,
          tool_trace: toolTrace,
          optimization: answer.optimization ?? {
            ai_invoked: false,
            cache_hit: false,
            path: "DETERMINISTIC_OR_REVIEW",
          },
          product_ids: answer.product_ids ?? [],
          product_media: answer.product_media ?? [],
          pending_customer_input: answer.pending_customer_input ?? null,
          grounding_source: answer.product_ids?.length
            ? "LIVE_CATALOG"
            : answer.live_order
              ? "LIVE_ORDER"
            : answer.grounded
              ? "APPROVED_KNOWLEDGE"
              : "CONVERSATION",
        },
      },
      sharedContext
    )
    const delivery = await this.createAgentDeliveries(
      {
        attempt_count: 0,
        available_at: now,
        channel: conversation.channel,
        connection_id: connection.id,
        idempotency_key: `message:${response.id}:delivery`,
        message_id: response.id,
        status: "PENDING",
      },
      sharedContext
    )
    await this.updateAgentConversations(
      { id: conversation.id, last_message_at: now },
      sharedContext
    )
    this.broadcastMessageCreated(response)
    this.broadcastConversationUpdated({
      channel: conversation.channel,
      id: conversation.id,
      last_message_at: now,
      title: conversation.title,
    })
    await this.createAgentAuditEvents(
      {
        action: "customer-knowledge-answer-created",
        actor_id: "customer-knowledge-agent",
        actor_type: "agent",
        correlation_id: `${conversation.channel.toLowerCase()}:${connection.id}:${inbound.id}`,
        data: {
          citation_count: answer.citations.length,
          grounded: answer.grounded,
          disposition: answer.disposition,
          inbound_message_id: inbound.id,
          intent: routedIntent,
          intent_confidence: intent.confidence,
          optimization: answer.optimization ?? {
            ai_invoked: false,
            cache_hit: false,
            path: "DETERMINISTIC_OR_REVIEW",
          },
          product_ids: answer.product_ids ?? [],
          response_message_id: response.id,
          tool_trace: toolTrace,
        },
        event_type: "agent.knowledge.answer-created",
        recorded_at: now,
        resource_id: response.id,
        resource_type: "agent_message",
      },
      sharedContext
    )
    const quality = evaluateConversationQuality(
      question,
      response.body,
      answer.grounded
    )
    await this.createAgentAuditEvents(
      {
        action: "customer-response-quality-evaluated",
        actor_id: "customer-knowledge-agent",
        actor_type: "agent",
        correlation_id: `${conversation.channel.toLowerCase()}:${connection.id}:${inbound.id}`,
        data: {
          inbound_message_id: inbound.id,
          response_message_id: response.id,
          ...quality,
        },
        event_type: "agent.customer-support.quality-evaluated",
        recorded_at: now,
        resource_id: response.id,
        resource_type: "agent_message",
      },
      sharedContext
    )

    return {
      delivery_id: delivery.id,
      duplicate: false,
      grounded: answer.grounded,
      response_message_id: response.id,
      support_task_id: supportTaskId,
    }
  }

  @InjectManager()
  async createCustomerKnowledgeEscalation(
    input: {
      conversation_id: string
      inbound_message_id: string
      locale: "en" | "vi"
      question: string
      reason:
        | "NEEDS_STAFF_AUTHORITY"
        | "NO_APPROVED_KNOWLEDGE"
        | "CUSTOMER_DISTRESS"
        | "VISION_REVIEW"
      vision_analysis?: VisionDefectAnalysisOutput
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.createCustomerKnowledgeEscalation_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async createCustomerKnowledgeEscalation_(
    input: {
      conversation_id: string
      inbound_message_id: string
      locale: "en" | "vi"
      question: string
      reason:
        | "NEEDS_STAFF_AUTHORITY"
        | "NO_APPROVED_KNOWLEDGE"
        | "CUSTOMER_DISTRESS"
        | "VISION_REVIEW"
      vision_analysis?: VisionDefectAnalysisOutput
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const taskIdempotencyKey =
      `customer-knowledge-escalation:${input.inbound_message_id}`
    const existingTask = (
      await this.listAgentTasks(
        { idempotency_key: taskIdempotencyKey },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (existingTask) {
      return {
        duplicate: true,
        incident: existingTask.incident_id
          ? await this.retrieveAgentIncident(
              existingTask.incident_id,
              {},
              sharedContext
            )
          : null,
        task: existingTask,
      }
    }

    const [conversation, inbound] = await Promise.all([
      this.retrieveAgentConversation(input.conversation_id, {}, sharedContext),
      this.retrieveAgentMessage(input.inbound_message_id, {}, sharedContext),
    ])
    const metadata = (conversation.metadata ?? {}) as Record<string, unknown>
    if (
      inbound.conversation_id !== conversation.id ||
      !isCustomerSupportConversation({
        metadata,
        topic_type: conversation.topic_type,
      })
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only a customer support conversation can create a knowledge escalation."
      )
    }

    const connectionId =
      typeof metadata.connection_id === "string" ? metadata.connection_id : null
    const connection = connectionId
      ? await this.retrieveAgentChannelConnection(connectionId, {}, sharedContext)
      : null
    const security = normalizeCustomerChatSecurityConfig(
      connection && connection.channel === "TELEGRAM"
        ? ((connection.config as Record<string, unknown>).security as never)
        : null
    )
    const [openTasks, openTaskCount] = await this.listAndCountAgentTasks(
      {
        conversation_id: conversation.id,
        status: ["TODO", "CLAIMED", "IN_PROGRESS", "WAITING"],
        task_type: "SUPPORT_RESPONSE_REVIEW",
      },
      { take: security.max_open_escalations },
      sharedContext
    )
    if (openTaskCount >= security.max_open_escalations) {
      await this.createAgentAuditEvents(
        {
          action: "customer-question-escalation-suppressed",
          actor_id: "customer-knowledge-agent",
          actor_type: "agent",
          correlation_id: `customer-escalation-cap:${conversation.id}:${inbound.id}`,
          data: {
            conversation_id: conversation.id,
            limit: security.max_open_escalations,
            open_task_ids: openTasks.map((task) => task.id),
            reason: "OPEN_ESCALATION_LIMIT",
          },
          event_type: "agent.support-response.escalation-suppressed",
          recorded_at: new Date(),
          resource_id: conversation.id,
          resource_type: "agent_conversation",
        },
        sharedContext
      )
      return { duplicate: false, incident: null, suppressed: true, task: null }
    }

    const now = new Date()
    const correlationId =
      `${conversation.channel.toLowerCase()}:knowledge-escalation:` + inbound.id
    const event = await this.createAgentEvents(
      {
        correlation_id: correlationId,
        event_id: inbound.id,
        event_type:
          input.reason === "NO_APPROVED_KNOWLEDGE"
            ? "support.knowledge-unanswered"
            : input.reason === "CUSTOMER_DISTRESS"
              ? "support.customer-distress"
              : input.reason === "VISION_REVIEW"
                ? "support.customer-image-review"
              : "support.staff-action-requested",
        event_version: 1,
        occurred_at: inbound.occurred_at,
        payload: {
          channel: conversation.channel,
          conversation_id: conversation.id,
          locale: input.locale,
          question: input.question,
          reason: input.reason,
          vision_analysis: input.vision_analysis ?? null,
        },
        processed_at: now,
        received_at: now,
        source: `${conversation.channel.toLowerCase()}-customer-support`,
        status: "PROCESSED",
        subject_id: conversation.id,
        subject_type: "conversation",
        tenant_id: conversation.tenant_id,
      },
      sharedContext
    )
    const incident = await this.createAgentIncidents(
      {
        context: {
          channel: conversation.channel,
          customer_id: inbound.sender_id,
          locale: input.locale,
          reason: input.reason,
        },
        correlation_id: correlationId,
        incident_type: "CUSTOMER_SUPPORT",
        priority:
          input.reason === "CUSTOMER_DISTRESS" ? "CRITICAL" : "MEDIUM",
        status: "ESCALATED",
        subject_id: conversation.id,
        subject_type: "conversation",
        summary: input.question,
        tenant_id: conversation.tenant_id,
        title:
          input.reason === "CUSTOMER_DISTRESS"
            ? `${conversation.channel} customer distress requires urgent staff response`
            : input.reason === "VISION_REVIEW"
              ? `${conversation.channel} customer image requires staff review`
            : input.reason === "NEEDS_STAFF_AUTHORITY"
            ? `${conversation.channel} customer request requiring staff action`
            : `Unanswered ${conversation.channel} customer question`,
        trigger_event_id: event.id,
      },
      sharedContext
    )
    const task = await this.createAgentTasks(
      {
        created_by_id: "customer-knowledge-agent",
        created_by_type: "agent",
        conversation_id: conversation.id,
        description:
          input.reason === "CUSTOMER_DISTRESS"
            ? "Contact the customer urgently, assess the complaint, and send a verified response through the original channel."
            : input.reason === "NEEDS_STAFF_AUTHORITY"
            ? "Review the customer's request, make the authorized decision or action, and send a verified response through the original channel."
            : "Review the customer's question, write a verified response, and send it back through the original channel.",
        due_at: new Date(
          now.getTime() +
            (input.reason === "CUSTOMER_DISTRESS" ? 5 : 30) * 60 * 1_000
        ),
        idempotency_key: taskIdempotencyKey,
        incident_id: incident.id,
        input: {
          channel: conversation.channel,
          conversation_id: conversation.id,
          customer_id: inbound.sender_id,
          draft: "",
          grounded: false,
          locale: input.locale,
          question: input.question,
          routing_reason: input.reason,
          requires_human_review: true,
          vision_analysis: input.vision_analysis ?? null,
        },
        priority: input.reason === "CUSTOMER_DISTRESS" ? "CRITICAL" : "MEDIUM",
        status: "TODO",
        task_type: "SUPPORT_RESPONSE_REVIEW",
        tenant_id: conversation.tenant_id,
        title: `Answer ${conversation.channel} customer question`,
      },
      sharedContext
    )
    this.broadcastTaskUpdated({
      assigned_to_id: task.assigned_to_id,
      id: task.id,
      priority: task.priority,
      status: task.status,
      support_conversation_id: conversation.id,
      task_type: task.task_type,
    })
    this.broadcastConversationUpdated({
      channel: conversation.channel,
      id: conversation.id,
      last_message_at: now,
      metadata: { requires_human_attention: true },
      title: conversation.title,
    })
    await this.createAgentAuditEvents(
      {
        action: "customer-question-escalated",
        actor_id: "customer-knowledge-agent",
        actor_type: "agent",
        correlation_id: correlationId,
        data: {
          channel: conversation.channel,
          conversation_id: conversation.id,
          reason: input.reason,
          task_id: task.id,
        },
        event_type: "agent.support-response.escalated",
        incident_id: incident.id,
        recorded_at: now,
        resource_id: task.id,
        resource_type: "agent_task",
      },
      sharedContext
    )

    return { duplicate: false, incident, task }
  }

  @InjectManager()
  async processTelegramKnowledgeQuestion(
    input: ProcessTelegramKnowledgeQuestionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.processCustomerKnowledgeQuestion(input, sharedContext)
  }

  @InjectManager()
  async searchAgentAuditTrail(
    input: AuditSearchInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AuditSearchOutput> {
    const parsed = AuditSearchInput.parse(input)
    const { limit, ...filters } = parsed
    const events = await this.listAgentAuditEvents(
      filters,
      { order: { recorded_at: "DESC" }, take: limit },
      sharedContext
    )

    return formatAuditSearchResult(events)
  }

  @InjectManager()
  async replayAgentTrace(
    input: TraceReplayInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TraceReplayOutput> {
    const parsed = TraceReplayInput.parse(input)
    let correlationId = parsed.correlation_id
    const incidentIds = new Set<string>()

    if (parsed.incident_id) {
      const incident = await this.retrieveAgentIncident(
        parsed.incident_id,
        {},
        sharedContext
      )
      incidentIds.add(incident.id)
      correlationId = incident.correlation_id
    } else if (correlationId) {
      const incidents = await this.listAgentIncidents(
        { correlation_id: correlationId },
        { order: { created_at: "ASC" }, take: 100 },
        sharedContext
      )
      incidents.forEach((incident) => incidentIds.add(incident.id))
    }

    const [sourceEvents, correlationAuditEvents] = correlationId
      ? await Promise.all([
          this.listAgentEvents(
            { correlation_id: correlationId },
            { order: { occurred_at: "ASC" }, take: parsed.limit },
            sharedContext
          ),
          this.listAgentAuditEvents(
            { correlation_id: correlationId },
            { order: { recorded_at: "ASC" }, take: parsed.limit },
            sharedContext
          ),
        ])
      : [[], []]

    correlationAuditEvents.forEach((event) => {
      if (event.incident_id) incidentIds.add(event.incident_id)
    })

    const timeline: TraceTimelineEntry[] = sourceEvents.map((event) => ({
      category: "EVENT",
      data: {
        causation_id: event.causation_id,
        payload: event.payload,
        source: event.source,
        subject_id: event.subject_id,
        subject_type: event.subject_type,
      },
      entry_id: event.id,
      name: event.event_type,
      occurred_at: new Date(event.occurred_at).toISOString(),
      status: event.status,
    }))

    timeline.push(
      ...correlationAuditEvents.map((event) => ({
        category: "AUDIT" as const,
        data: event.data ?? null,
        entry_id: event.id,
        name: event.event_type,
        occurred_at: new Date(event.recorded_at).toISOString(),
        status: null,
      }))
    )

    for (const incidentId of incidentIds) {
      const [runs, actions, toolCalls, auditEvents, outboxEvents] =
        await Promise.all([
          this.listAgentRuns(
            { incident_id: incidentId },
            { order: { started_at: "ASC" }, take: parsed.limit },
            sharedContext
          ),
          this.listAgentActionRequests(
            { incident_id: incidentId },
            { order: { requested_at: "ASC" }, take: parsed.limit },
            sharedContext
          ),
          this.listAgentToolCalls(
            { incident_id: incidentId },
            { order: { started_at: "ASC" }, take: parsed.limit },
            sharedContext
          ),
          this.listAgentAuditEvents(
            { incident_id: incidentId },
            { order: { recorded_at: "ASC" }, take: parsed.limit },
            sharedContext
          ),
          this.listAgentOutboxEvents(
            { aggregate_id: incidentId, aggregate_type: "agent_incident" },
            { order: { created_at: "ASC" }, take: parsed.limit },
            sharedContext
          ),
        ])

      timeline.push(
        ...runs.map((run) => ({
          category: "RUN" as const,
          data: {
            agent_id: run.agent_id,
            agent_version: run.agent_version,
            error: run.error,
            output: run.output,
          },
          entry_id: run.id,
          name: run.agent_id,
          occurred_at: new Date(run.started_at).toISOString(),
          status: run.status,
        })),
        ...actions.map((action) => ({
          category: "ACTION" as const,
          data: {
            approval_id: action.approval_id,
            attempt_count: action.attempt_count,
            last_error: action.last_error,
            risk_level: action.risk_level,
            tool_version: action.tool_version,
          },
          entry_id: action.id,
          name: action.tool_name,
          occurred_at: new Date(action.requested_at).toISOString(),
          status: action.status,
        })),
        ...toolCalls.map((toolCall) => ({
          category: "TOOL_CALL" as const,
          data: {
            action_request_id: toolCall.action_request_id,
            error: toolCall.error,
            kind: toolCall.kind,
            output: toolCall.output,
            tool_version: toolCall.tool_version,
          },
          entry_id: toolCall.id,
          name: toolCall.tool_name,
          occurred_at: new Date(toolCall.started_at).toISOString(),
          status: toolCall.status,
        })),
        ...auditEvents.map((event) => ({
          category: "AUDIT" as const,
          data: event.data ?? null,
          entry_id: event.id,
          name: event.event_type,
          occurred_at: new Date(event.recorded_at).toISOString(),
          status: null,
        })),
        ...outboxEvents.map((event) => ({
          category: "OUTBOX" as const,
          data: {
            attempt_count: event.attempt_count,
            idempotency_key: event.idempotency_key,
            last_error: event.last_error,
          },
          entry_id: event.id,
          name: event.event_type,
          occurred_at: new Date(event.created_at).toISOString(),
          status: event.status,
        }))
      )
    }

    const uniqueTimeline = [
      ...new Map(
        timeline.map((entry) => [`${entry.category}:${entry.entry_id}`, entry])
      ).values(),
    ]

    return buildTraceReplayOutput({
      correlation_id: correlationId,
      incident_ids: [...incidentIds],
      limit: parsed.limit,
      timeline: uniqueTimeline,
    })
  }

  @InjectManager()
  async runAgentEvaluation(
    input: {
      idempotency_key: string
      observed: Record<string, unknown>
      scenario_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.runAgentEvaluation_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async runAgentEvaluation_(
    input: {
      idempotency_key: string
      observed: Record<string, unknown>
      scenario_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const existing = await this.listAgentEvaluationRuns(
      { idempotency_key: input.idempotency_key },
      { take: 1 },
      sharedContext
    )
    if (existing[0]) {
      return { duplicate: true, run: existing[0] }
    }

    const scenario = await this.retrieveAgentEvaluationCase(
      input.scenario_id,
      {},
      sharedContext
    )
    if (scenario.status !== "ACTIVE") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Evaluation scenario ${scenario.id} is not active.`
      )
    }

    const expected = evaluateAssertions(
      input.observed,
      (scenario.expected_assertions.all ?? []) as EvaluationAssertion[]
    )
    const forbidden = evaluateAssertions(
      input.observed,
      (scenario.forbidden_assertions.any ?? []) as EvaluationAssertion[]
    )
    const forbiddenPassed = forbidden.results.every((result) => !result.passed)
    const passed = expected.passed && forbiddenPassed
    const now = new Date()
    const resultCount = expected.results.length + forbidden.results.length
    const passedCount =
      expected.results.filter((result) => result.passed).length +
      forbidden.results.filter((result) => !result.passed).length
    const run = await this.createAgentEvaluationRuns(
      {
        assertion_results: {
          expected: expected.results,
          forbidden: forbidden.results.map((result) => ({
            ...result,
            passed: !result.passed,
          })),
        },
        completed_at: now,
        idempotency_key: input.idempotency_key,
        observed: input.observed,
        scenario_id: scenario.id,
        score: resultCount
          ? Math.round((passedCount / resultCount) * 10_000)
          : 10_000,
        started_at: now,
        status: passed ? "PASSED" : "FAILED",
      },
      sharedContext
    )

    return { duplicate: false, run }
  }

  @InjectManager()
  async recordCustomerReadToolCall(
    input: {
      conversation_id: string
      inbound_message_id: string
      input: Record<string, unknown>
      output: Record<string, unknown>
      tool_name: string
      tool_version: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.recordCustomerReadToolCall_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async recordCustomerReadToolCall_(
    input: {
      conversation_id: string
      inbound_message_id: string
      input: Record<string, unknown>
      output: Record<string, unknown>
      tool_name: string
      tool_version: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const idempotencyKey = [
      "customer-read-tool",
      input.inbound_message_id,
      input.tool_name,
      input.tool_version,
    ].join(":")
    const existing = (
      await this.listAgentToolCalls(
        { idempotency_key: idempotencyKey },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (existing) return { duplicate: true, tool_call: existing }

    const now = new Date()
    const toolCall = await this.createAgentToolCalls(
      {
        action_request_id: null,
        agent_id: "customer-support-agent",
        completed_at: now,
        conversation_id: input.conversation_id,
        error: null,
        idempotency_key: idempotencyKey,
        incident_id: null,
        input: input.input,
        kind: "READ",
        output: input.output,
        started_at: now,
        status: "SUCCEEDED",
        tool_name: input.tool_name,
        tool_version: input.tool_version,
      },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "customer-read-tool-executed",
        actor_id: "customer-support-agent",
        actor_type: "agent",
        correlation_id: `customer-tool:${input.conversation_id}:${input.inbound_message_id}`,
        data: {
          inbound_message_id: input.inbound_message_id,
          tool_call_id: toolCall.id,
          tool_name: input.tool_name,
          tool_version: input.tool_version,
        },
        event_type: "agent.customer-support.read-tool-executed",
        recorded_at: now,
        resource_id: toolCall.id,
        resource_type: "agent_tool_call",
      },
      sharedContext
    )
    return { duplicate: false, tool_call: toolCall }
  }

  @InjectManager()
  async processInventoryLowEvent(
    input: InventoryLowEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.processInventoryLowEvent_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async processInventoryLowEvent_(
    input: InventoryLowEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const existingEvents = await this.listAgentEvents(
      {
        event_id: input.event_id,
        source: input.source,
      },
      { take: 1 },
      sharedContext
    )
    const existingEvent = existingEvents[0]

    if (existingEvent) {
      const incidents = await this.listAgentIncidents(
        { trigger_event_id: existingEvent.id },
        { take: 1 },
        sharedContext
      )

      return {
        approval: await this.findApprovalForIncident(
          incidents[0]?.id,
          sharedContext
        ),
        duplicate: true,
        event: existingEvent,
        incident: incidents[0],
        recommendation: await this.findRecommendationForIncident(
          incidents[0]?.id,
          sharedContext
        ),
      }
    }

    const now = new Date()
    const recommendation = analyzeInventoryLow(input.payload)
    const activePolicyRecords = await this.listAgentPolicyDefinitions(
      {
        action_type: recommendation.action_type,
        status: "ACTIVE",
      },
      {},
      sharedContext
    )
    const activePolicies = activePolicyRecords.filter(
      (policy) =>
        policy.effective_at <= now &&
        (!policy.expires_at || policy.expires_at > now)
    )
    const policyDecision = evaluatePolicies(
      activePolicies.map((policy) => ({
        action_type: policy.action_type,
        conditions: (policy.conditions.all ?? []) as PolicyCondition[],
        policy_key: policy.policy_key,
        policy_version: policy.version,
        required_role: policy.required_role,
        requires_approval: policy.requires_approval,
        risk_level: policy.risk_level,
      })),
      recommendation.action_type,
      {
        available_quantity: input.payload.available_quantity,
        required_quantity: input.payload.required_quantity,
        shortfall: Math.max(
          input.payload.required_quantity - input.payload.available_quantity,
          0
        ),
      }
    )
    const matchedPolicy = activePolicies.find(
      (policy) =>
        policy.policy_key === policyDecision.matched_policies[0]?.policy_key &&
        policy.version === policyDecision.matched_policies[0]?.policy_version
    )
    const requiresApproval = matchedPolicy
      ? policyDecision.requires_approval
      : recommendation.requires_approval
    const riskLevel = matchedPolicy
      ? policyDecision.risk_level
      : recommendation.risk_level
    const event = await this.createAgentEvents(
      {
        causation_id: input.causation_id,
        correlation_id: input.correlation_id,
        event_id: input.event_id,
        event_type: input.event_type,
        event_version: input.event_version,
        occurred_at: new Date(input.occurred_at),
        payload: input.payload,
        processed_at: now,
        received_at: now,
        source: input.source,
        status: "PROCESSED",
        subject_id: input.subject_id,
        subject_type: input.subject_type,
        tenant_id: input.tenant_id,
      },
      sharedContext
    )

    const incident = await this.createAgentIncidents(
      {
        context: {
          event_id: event.id,
          event_type: event.event_type,
        },
        correlation_id: input.correlation_id,
        incident_type: "INVENTORY_RISK",
        priority: riskLevel === "HIGH" ? "HIGH" : "MEDIUM",
        status: "RECEIVED",
        subject_id: input.subject_id,
        subject_type: input.subject_type,
        summary: recommendation.summary,
        tenant_id: input.tenant_id,
        title: `Inventory risk for ${input.payload.inventory_item_id}`,
        trigger_event_id: event.id,
      },
      sharedContext
    )

    const run = await this.createAgentRuns(
      {
        agent_id: "inventory-agent",
        agent_version: "0.1.0",
        incident_id: incident.id,
        input: input.payload,
        started_at: now,
        status: "RECEIVED",
        trigger_event_id: event.id,
      },
      sharedContext
    )

    await this.transitionIncident(
      incident.id,
      "RECEIVED",
      "INVESTIGATING",
      sharedContext
    )

    const recommendationRecord = await this.createAgentRecommendations(
      {
        action_type: recommendation.action_type,
        evidence: recommendation.evidence,
        incident_id: incident.id,
        proposal: recommendation.proposal,
        rationale: recommendation.rationale,
        risk_level: riskLevel,
        run_id: run.id,
        status: requiresApproval ? "PENDING_APPROVAL" : "PROPOSED",
        summary: recommendation.summary,
      },
      sharedContext
    )

    let approval: Awaited<
      ReturnType<typeof this.retrieveAgentApproval>
    > | null = null
    let finalStatus: IncidentStatus

    if (requiresApproval) {
      await this.transitionIncident(
        incident.id,
        "INVESTIGATING",
        "OPTIONS_READY",
        sharedContext
      )
      await this.transitionIncident(
        incident.id,
        "OPTIONS_READY",
        "AWAITING_APPROVAL",
        sharedContext
      )

      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      approval = await this.createAgentApprovals(
        {
          expires_at: expiresAt,
          incident_id: incident.id,
          policy_key:
            matchedPolicy?.policy_key ??
            "inventory.transfer.requires-operations-manager",
          policy_version: matchedPolicy?.version ?? "1.0.0",
          recommendation_id: recommendationRecord.id,
          requested_at: now,
          requested_by_id: run.id,
          requested_by_type: "agent_run",
          required_role:
            policyDecision.required_roles[0] ?? "operations_manager",
          status: "PENDING",
        },
        sharedContext
      )
      finalStatus = "AWAITING_APPROVAL"
    } else {
      finalStatus = recommendation.terminal_status ?? "ESCALATED"
      await this.transitionIncident(
        incident.id,
        "INVESTIGATING",
        finalStatus,
        sharedContext
      )
    }

    await this.updateAgentRuns(
      {
        id: run.id,
        completed_at: now,
        output: recommendation,
        status: finalStatus,
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "inventory-risk-analyzed",
        actor_id: run.id,
        actor_type: "agent_run",
        correlation_id: input.correlation_id,
        data: {
          approval_id: approval?.id,
          recommendation_id: recommendationRecord.id,
          risk_level: riskLevel,
        },
        event_type: "agent.recommendation.created",
        incident_id: incident.id,
        recorded_at: now,
        resource_id: recommendationRecord.id,
        resource_type: "agent_recommendation",
        run_id: run.id,
      },
      sharedContext
    )

    await this.createAgentOutboxEvents(
      {
        aggregate_id: incident.id,
        aggregate_type: "agent_incident",
        available_at: now,
        event_type: approval
          ? "agent.approval.requested"
          : "agent.recommendation.created",
        event_version: 1,
        idempotency_key: `${input.source}:${input.event_id}:recommendation`,
        payload: {
          approval_id: approval?.id,
          incident_id: incident.id,
          recommendation_id: recommendationRecord.id,
          run_id: run.id,
          status: finalStatus,
        },
        status: "PENDING",
      },
      sharedContext
    )

    return {
      approval,
      duplicate: false,
      event,
      incident: await this.retrieveAgentIncident(
        incident.id,
        {},
        sharedContext
      ),
      recommendation: recommendationRecord,
    }
  }

  @InjectManager()
  async processOrderExceptionEvent(
    input: OrderExceptionEventInput,
    liveOrder: OrderReadOutput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.processOrderExceptionEvent_(input, liveOrder, sharedContext)
  }

  @InjectTransactionManager()
  protected async processOrderExceptionEvent_(
    input: OrderExceptionEventInput,
    liveOrder: OrderReadOutput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    if (
      input.subject_id !== input.payload.order_id ||
      liveOrder.order_id !== input.payload.order_id
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Order exception subject, payload, and live order must reference the same order."
      )
    }

    const existingEvents = await this.listAgentEvents(
      { event_id: input.event_id, source: input.source },
      { take: 1 },
      sharedContext
    )
    const existingEvent = existingEvents[0]

    if (existingEvent) {
      const incidents = await this.listAgentIncidents(
        { trigger_event_id: existingEvent.id },
        { take: 1 },
        sharedContext
      )
      const incident = incidents[0]
      const actionRequests = incident
        ? await this.listAgentActionRequests(
            { incident_id: incident.id, tool_name: "task.create" },
            { take: 1 },
            sharedContext
          )
        : []

      return {
        action_request: actionRequests[0] ?? null,
        duplicate: true,
        event: existingEvent,
        incident,
        live_order: liveOrder,
        recommendation: await this.findRecommendationForIncident(
          incident?.id,
          sharedContext
        ),
      }
    }

    const now = new Date()
    const recommendation = analyzeOrderException(input, liveOrder)
    const event = await this.createAgentEvents(
      {
        causation_id: input.causation_id,
        correlation_id: input.correlation_id,
        event_id: input.event_id,
        event_type: input.event_type,
        event_version: input.event_version,
        occurred_at: new Date(input.occurred_at),
        payload: input.payload,
        processed_at: now,
        received_at: now,
        source: input.source,
        status: "PROCESSED",
        subject_id: input.subject_id,
        subject_type: input.subject_type,
        tenant_id: input.tenant_id,
      },
      sharedContext
    )
    const incident = await this.createAgentIncidents(
      {
        context: {
          exception_type: input.payload.exception_type,
          live_order: liveOrder,
        },
        correlation_id: input.correlation_id,
        incident_type: "ORDER_EXCEPTION",
        priority: recommendation.risk_level === "HIGH" ? "HIGH" : "MEDIUM",
        status: "RECEIVED",
        subject_id: input.subject_id,
        subject_type: input.subject_type,
        summary: recommendation.summary,
        tenant_id: input.tenant_id,
        title: `Order exception for #${liveOrder.display_id}`,
        trigger_event_id: event.id,
      },
      sharedContext
    )
    const run = await this.createAgentRuns(
      {
        agent_id: "order-exception-agent",
        agent_version: "0.1.0",
        incident_id: incident.id,
        input: {
          event: input.payload,
          live_order: liveOrder,
        },
        started_at: now,
        status: "RECEIVED",
        trigger_event_id: event.id,
      },
      sharedContext
    )

    await this.transitionIncident(
      incident.id,
      "RECEIVED",
      "INVESTIGATING",
      sharedContext
    )

    const recommendationRecord = await this.createAgentRecommendations(
      {
        action_type: recommendation.action_type,
        evidence: recommendation.evidence,
        incident_id: incident.id,
        proposal: recommendation.proposal,
        rationale: recommendation.rationale,
        risk_level: recommendation.risk_level,
        run_id: run.id,
        status: "PROPOSED",
        summary: recommendation.summary,
      },
      sharedContext
    )

    let actionRequest: Awaited<
      ReturnType<typeof this.retrieveAgentActionRequest>
    > | null = null
    const finalStatus = recommendation.terminal_status ?? "OPTIONS_READY"

    await this.transitionIncident(
      incident.id,
      "INVESTIGATING",
      finalStatus,
      sharedContext
    )

    if (recommendation.action_type === "CREATE_TASK") {
      const actionResult = await this.requestGovernedAgentAction_(
        {
          correlation_id: input.correlation_id,
          granted_permissions: ["agent_task:create"],
          idempotency_key: `${input.source}:${input.event_id}:task-create`,
          incident_id: incident.id,
          input: {
            ...recommendation.proposal,
            incident_id: incident.id,
          },
          recommendation_id: recommendationRecord.id,
          requested_by_id: run.id,
          requested_by_type: "agent",
          tenant_id: input.tenant_id,
          tool_name: "task.create",
          tool_version: "1.0.0",
        },
        sharedContext
      )
      actionRequest = actionResult.action
    }

    await this.updateAgentRuns(
      {
        id: run.id,
        completed_at: now,
        output: {
          action_request_id: actionRequest?.id ?? null,
          recommendation,
        },
        status: finalStatus,
      },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "order-exception-analyzed",
        actor_id: run.id,
        actor_type: "agent_run",
        correlation_id: input.correlation_id,
        data: {
          action_request_id: actionRequest?.id ?? null,
          exception_type: input.payload.exception_type,
          live_order_version: liveOrder.version,
          recommendation_id: recommendationRecord.id,
        },
        event_type: "agent.order-exception.analyzed",
        incident_id: incident.id,
        recorded_at: now,
        resource_id: recommendationRecord.id,
        resource_type: "agent_recommendation",
        run_id: run.id,
      },
      sharedContext
    )

    if (!actionRequest) {
      await this.createAgentOutboxEvents(
        {
          aggregate_id: incident.id,
          aggregate_type: "agent_incident",
          available_at: now,
          event_type: "agent.order-exception.resolved",
          event_version: 1,
          idempotency_key: `${input.source}:${input.event_id}:resolved`,
          payload: {
            incident_id: incident.id,
            order_id: liveOrder.order_id,
            recommendation_id: recommendationRecord.id,
          },
          status: "PENDING",
        },
        sharedContext
      )
    }

    return {
      action_request: actionRequest,
      duplicate: false,
      event,
      incident: await this.retrieveAgentIncident(
        incident.id,
        {},
        sharedContext
      ),
      live_order: liveOrder,
      recommendation: recommendationRecord,
    }
  }

  @InjectManager()
  async draftGovernedCustomerResponse(
    input: ResponseDraftInput,
    idempotencyKey: string,
    tenantId = "default",
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ResponseDraftOutput> {
    const parsed = ResponseDraftInput.parse(input)
    const deterministic = draftCustomerResponse(parsed)

    if (!deterministic.grounded) return deterministic

    const activePrompts = await this.listAgentPromptTemplates(
      { prompt_key: CUSTOMER_SUPPORT_PROMPT_KEY, status: "ACTIVE" },
      { order: { created_at: "DESC" }, take: 1 },
      sharedContext
    )
    const activePrompt = activePrompts[0]
    const prompt = {
      max_tokens:
        activePrompt?.max_tokens ?? CUSTOMER_SUPPORT_DEFAULT_MAX_TOKENS,
      output_schema:
        (activePrompt?.output_schema as Record<string, unknown> | undefined) ??
        CUSTOMER_SUPPORT_DEFAULT_OUTPUT_SCHEMA,
      prompt_key: activePrompt?.prompt_key ?? CUSTOMER_SUPPORT_PROMPT_KEY,
      system_prompt:
        activePrompt?.system_prompt ?? CUSTOMER_SUPPORT_DEFAULT_SYSTEM_PROMPT,
      version: activePrompt?.version ?? CUSTOMER_SUPPORT_PROMPT_VERSION,
    }

    const legacyRun = (
      await this.listAgentModelRuns(
        { idempotency_key: idempotencyKey },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (legacyRun?.status === "SUCCEEDED" && legacyRun.output) {
      const cached = ResponseDraftOutput.safeParse(legacyRun.output)
      return cached.success ? cached.data : deterministic
    }

    const safeInput = {
      approved_knowledge: parsed.knowledge.map((item) => ({
        excerpt: item.excerpt,
        locator: item.citation_locator,
        title: item.title,
        version: item.version,
      })),
      locale: parsed.locale,
      live_order: {
        display_id: parsed.order.display_id,
        fulfillment_status: parsed.order.fulfillment_status,
        order_status: parsed.order.order_status,
        payment_status: parsed.order.payment_status,
      },
      question: parsed.question,
    }
    let credentials
    try {
      credentials = await this.getActiveAiProviderCredentials(
        "generation",
        tenantId
      )
    } catch {
      return deterministic
    }

    for (const credential of credentials) {
      const adapter = createModelAdapter({
        apiKey: credential.api_key,
        model: credential.model,
        provider: credential.provider,
      })
      const attemptKey = `${idempotencyKey}:provider:${adapter.provider}`
      const existing = (
        await this.listAgentModelRuns(
          { idempotency_key: attemptKey },
          { take: 1 },
          sharedContext
        )
      )[0]
      if (existing?.status === "SUCCEEDED" && existing.output) {
        const cached = ResponseDraftOutput.safeParse(existing.output)
        if (cached.success) return cached.data
      }
      if (existing?.status === "RUNNING") return deterministic
      if (existing) continue

      const startedAt = new Date()
      const modelRun = await this.createAgentModelRuns(
        {
          agent_id: "customer-support-agent",
          agent_version: "0.2.0",
          idempotency_key: attemptKey,
          input: redactModelInput(safeInput) as Record<string, unknown>,
          model: adapter.model,
          prompt_key: prompt.prompt_key,
          prompt_version: prompt.version,
          provider: adapter.provider,
          redacted: true,
          started_at: startedAt,
          status: "RUNNING",
        },
        sharedContext
      )

      try {
        const generated = await adapter.invoke({
          agent_id: "customer-support-agent",
          input: safeInput,
          max_tokens: prompt.max_tokens,
          output_schema: prompt.output_schema,
          prompt_key: prompt.prompt_key,
          prompt_version: prompt.version,
          system_prompt: prompt.system_prompt,
        })
        const output = ResponseDraftOutput.parse({
          body: generated.body,
          citations: deterministic.citations,
          grounded: true,
          requires_human_review: true,
        })
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            output,
            status: "SUCCEEDED",
          },
          sharedContext
        )
        return output
      } catch (error) {
        await this.updateAgentModelRuns(
          {
            completed_at: new Date(),
            error:
              error instanceof Error
                ? error.message.slice(0, 1_000)
                : "Model draft failed",
            id: modelRun.id,
            latency_ms: Date.now() - startedAt.getTime(),
            status: "FAILED",
          },
          sharedContext
        )
      }
    }

    return deterministic
  }

  @InjectManager()
  async processSupportRequest(
    input: SupportRequestEventInput,
    liveOrder: OrderReadOutput,
    knowledge: KnowledgeSearchOutput,
    draft: ResponseDraftOutput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.processSupportRequest_(
      input,
      liveOrder,
      knowledge,
      draft,
      sharedContext
    )
  }

  @InjectTransactionManager()
  protected async processSupportRequest_(
    input: SupportRequestEventInput,
    liveOrder: OrderReadOutput,
    knowledge: KnowledgeSearchOutput,
    draft: ResponseDraftOutput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    assertSupportOrderAccess(input, liveOrder)

    const existingEvents = await this.listAgentEvents(
      { event_id: input.event_id, source: input.source },
      { take: 1 },
      sharedContext
    )
    const existingEvent = existingEvents[0]

    if (existingEvent) {
      const incident = (
        await this.listAgentIncidents(
          { trigger_event_id: existingEvent.id },
          { take: 1 },
          sharedContext
        )
      )[0]
      const actions = incident
        ? await this.listAgentActionRequests(
            { incident_id: incident.id, tool_name: "task.create" },
            { take: 1 },
            sharedContext
          )
        : []

      return {
        action_request: actions[0] ?? null,
        draft,
        duplicate: true,
        event: existingEvent,
        incident,
        knowledge,
        live_order: liveOrder,
        recommendation: await this.findRecommendationForIncident(
          incident?.id,
          sharedContext
        ),
      }
    }

    const now = new Date()
    const event = await this.createAgentEvents(
      {
        causation_id: input.causation_id,
        correlation_id: input.correlation_id,
        event_id: input.event_id,
        event_type: input.event_type,
        event_version: input.event_version,
        occurred_at: new Date(input.occurred_at),
        payload: input.payload,
        processed_at: now,
        received_at: now,
        source: input.source,
        status: "PROCESSED",
        subject_id: input.subject_id,
        subject_type: input.subject_type,
        tenant_id: input.tenant_id,
      },
      sharedContext
    )
    const incident = await this.createAgentIncidents(
      {
        context: {
          customer_id: input.payload.customer_id,
          draft_grounded: draft.grounded,
          live_order: liveOrder,
          request_type: input.payload.request_type,
        },
        correlation_id: input.correlation_id,
        incident_type: "CUSTOMER_SUPPORT",
        priority: "MEDIUM",
        status: "RECEIVED",
        subject_id: liveOrder.order_id,
        subject_type: "order",
        summary: input.payload.question,
        tenant_id: input.tenant_id,
        title: `Customer support request for #${liveOrder.display_id}`,
        trigger_event_id: event.id,
      },
      sharedContext
    )
    const run = await this.createAgentRuns(
      {
        agent_id: "customer-support-agent",
        agent_version: "0.1.0",
        incident_id: incident.id,
        input: {
          question: input.payload.question,
          request_type: input.payload.request_type,
        },
        started_at: now,
        status: "RECEIVED",
        trigger_event_id: event.id,
      },
      sharedContext
    )

    await this.transitionIncident(
      incident.id,
      "RECEIVED",
      "INVESTIGATING",
      sharedContext
    )

    const recommendation = await this.createAgentRecommendations(
      {
        action_type: "REVIEW_SUPPORT_RESPONSE",
        evidence: {
          citations: draft.citations,
          knowledge_candidate_count: knowledge.total_candidates,
          live_order_version: liveOrder.version,
        },
        incident_id: incident.id,
        proposal: {
          draft: draft.body,
          grounded: draft.grounded,
          message_sent: false,
          requires_human_review: true,
        },
        rationale: draft.grounded
          ? "Draft uses a live order snapshot and approved cited knowledge."
          : "No matching approved knowledge was found; manual review is required.",
        risk_level: "LOW",
        run_id: run.id,
        status: "PROPOSED",
        summary: `Review customer response draft for order #${liveOrder.display_id}`,
      },
      sharedContext
    )

    await this.transitionIncident(
      incident.id,
      "INVESTIGATING",
      "OPTIONS_READY",
      sharedContext
    )

    const dueAt = new Date(now.getTime() + 30 * 60 * 1_000).toISOString()
    const actionResult = await this.requestGovernedAgentAction_(
      {
        correlation_id: input.correlation_id,
        granted_permissions: ["agent_task:create"],
        idempotency_key: `${input.source}:${input.event_id}:support-review-task`,
        incident_id: incident.id,
        input: {
          description:
            "Review the grounded draft, verify the live order state, and edit before sending to the customer.",
          due_at: dueAt,
          incident_id: incident.id,
          input: {
            citations: draft.citations,
            customer_id: input.payload.customer_id,
            draft: draft.body,
            grounded: draft.grounded,
            order_id: liveOrder.order_id,
            question: input.payload.question,
            requires_human_review: true,
          },
          priority: "MEDIUM",
          task_type: "SUPPORT_RESPONSE_REVIEW",
          tenant_id: input.tenant_id,
          title: `Review response for order #${liveOrder.display_id}`,
        },
        recommendation_id: recommendation.id,
        requested_by_id: run.id,
        requested_by_type: "agent",
        tenant_id: input.tenant_id,
        tool_name: "task.create",
        tool_version: "1.0.0",
      },
      sharedContext
    )

    await this.updateAgentRuns(
      {
        completed_at: now,
        id: run.id,
        output: {
          action_request_id: actionResult.action.id,
          citations: draft.citations,
          draft_grounded: draft.grounded,
          message_sent: false,
          requires_human_review: true,
        },
        status: "OPTIONS_READY",
      },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "support-response-drafted",
        actor_id: run.id,
        actor_type: "agent_run",
        correlation_id: input.correlation_id,
        data: {
          action_request_id: actionResult.action.id,
          citation_count: draft.citations.length,
          grounded: draft.grounded,
          message_sent: false,
          recommendation_id: recommendation.id,
        },
        event_type: "agent.support-response.drafted",
        incident_id: incident.id,
        recorded_at: now,
        resource_id: recommendation.id,
        resource_type: "agent_recommendation",
        run_id: run.id,
      },
      sharedContext
    )

    return {
      action_request: actionResult.action,
      draft,
      duplicate: false,
      event,
      incident: await this.retrieveAgentIncident(
        incident.id,
        {},
        sharedContext
      ),
      knowledge,
      live_order: liveOrder,
      recommendation,
    }
  }

  @InjectManager()
  async createApprovalRequestedNotification(
    input: CreateApprovalRequestedNotificationInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.createApprovalRequestedNotification_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async createApprovalRequestedNotification_(
    input: CreateApprovalRequestedNotificationInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const idempotencyKey = `outbox:${input.outbox_event_id}:in-app`
    const existingMessages = await this.listAgentMessages(
      { idempotency_key: idempotencyKey },
      { take: 1 },
      sharedContext
    )
    const existingMessage = existingMessages[0]

    if (existingMessage) {
      return {
        conversation: await this.retrieveAgentConversation(
          existingMessage.conversation_id,
          {},
          sharedContext
        ),
        duplicate: true,
        message: existingMessage,
      }
    }

    const approval = await this.retrieveAgentApproval(
      input.approval_id,
      {},
      sharedContext
    )
    const incident = await this.retrieveAgentIncident(
      input.incident_id,
      {},
      sharedContext
    )
    const recommendation = await this.retrieveAgentRecommendation(
      input.recommendation_id,
      {},
      sharedContext
    )
    const conversations = await this.listAgentConversations(
      {
        channel: "IN_APP",
        topic_id: approval.id,
        topic_type: "APPROVAL",
      },
      { take: 1 },
      sharedContext
    )
    const now = new Date()
    const conversation =
      conversations[0] ??
      (await this.createAgentConversations(
        {
          channel: "IN_APP",
          incident_id: incident.id,
          last_message_at: now,
          metadata: {
            approval_id: approval.id,
            recommendation_id: recommendation.id,
          },
          opened_at: now,
          status: "OPEN",
          tenant_id: incident.tenant_id,
          title: `Approval required: ${incident.title}`,
          topic_id: approval.id,
          topic_type: "APPROVAL",
        },
        sharedContext
      ))
    const content = buildApprovalRequestedMessage({
      approval,
      incident,
      recommendation,
    })
    const message = await this.createAgentMessages(
      {
        body: content.body,
        channel: "IN_APP",
        conversation_id: conversation.id,
        direction: "OUTBOUND",
        idempotency_key: idempotencyKey,
        message_type: "NOTIFICATION",
        occurred_at: now,
        sender_id: "agent-operations",
        sender_type: "system",
        status: "AVAILABLE",
        structured_content: content.structured_content,
      },
      sharedContext
    )

    await this.updateAgentConversations(
      { id: conversation.id, last_message_at: now },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: "approval-notification-created",
        actor_id: "agent-operations",
        actor_type: "system",
        correlation_id: incident.correlation_id,
        data: {
          approval_id: approval.id,
          channel: "IN_APP",
          message_id: message.id,
        },
        event_type: "agent.communication.message.created",
        incident_id: incident.id,
        recorded_at: now,
        resource_id: message.id,
        resource_type: "agent_message",
      },
      sharedContext
    )

    return { conversation, duplicate: false, message }
  }

  @InjectManager()
  async processAgentConversationMessage(
    input: ProcessAgentConversationMessageInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.processAgentConversationMessage_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async processAgentConversationMessage_(
    input: ProcessAgentConversationMessageInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const inboundIdempotencyKey = `admin:${input.actor_id}:${input.client_message_id}`
    const responseIdempotencyKey = `reply:${inboundIdempotencyKey}`
    const existingMessages = await this.listAgentMessages(
      { idempotency_key: inboundIdempotencyKey },
      { take: 1 },
      sharedContext
    )
    const existingMessage = existingMessages[0]

    if (existingMessage) {
      const responses = await this.listAgentMessages(
        { idempotency_key: responseIdempotencyKey },
        { take: 1 },
        sharedContext
      )

      return {
        accepted: existingMessage.status === "PROCESSED",
        command_result: responses[0]?.structured_content ?? null,
        conversation: await this.retrieveAgentConversation(
          existingMessage.conversation_id,
          {},
          sharedContext
        ),
        duplicate: true,
        inbound_message: existingMessage,
        response_message: responses[0] ?? null,
      }
    }

    const conversation = await this.retrieveAgentConversation(
      input.conversation_id,
      {},
      sharedContext
    )

    if (conversation.status !== "OPEN") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Conversation ${conversation.id} is closed.`
      )
    }

    if (!conversation.incident_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Conversation ${conversation.id} is not linked to an incident.`
      )
    }

    const incident = await this.retrieveAgentIncident(
      conversation.incident_id,
      {},
      sharedContext
    )
    const now = new Date()
    const inboundMessage = await this.createAgentMessages(
      {
        body: input.body,
        channel: "IN_APP",
        command_name: input.command.name,
        conversation_id: conversation.id,
        direction: "INBOUND",
        idempotency_key: inboundIdempotencyKey,
        message_type: "COMMAND",
        occurred_at: now,
        sender_id: input.actor_id,
        sender_type: "user",
        status: "RECEIVED",
        structured_content: { command: input.command },
      },
      sharedContext
    )
    const targetIsValid = isApprovalDecisionCommandTarget(
      conversation,
      input.command
    )
    let accepted = false
    let actionRequestId: string | null = null
    let commandDuplicate = false
    let commandError: string | null = null

    if (!targetIsValid) {
      commandError = "Command approval does not match the conversation topic."
    } else {
      try {
        const decision = await this.decideApproval_(
          {
            actor_id: input.actor_id,
            approval_id: input.command.approval_id,
            decision: input.command.decision,
            reason: input.command.reason,
          },
          sharedContext
        )
        const conflict = "conflict" in decision ? decision.conflict : undefined

        accepted = !conflict
        commandDuplicate = decision.duplicate
        actionRequestId =
          "action_request" in decision
            ? (decision.action_request?.id ?? null)
            : null
        commandError = conflict ?? null
      } catch (error) {
        commandError =
          error instanceof Error ? error.message : "Unknown command error"
      }
    }

    const responseContent = accepted
      ? buildApprovalDecisionResultMessage({
          action_request_id: actionRequestId,
          approval_id: input.command.approval_id,
          decision: input.command.decision,
          duplicate: commandDuplicate,
        })
      : {
          body: `Không thể xử lý lệnh cho approval ${input.command.approval_id}: ${commandError}`,
          structured_content: {
            accepted: false,
            approval_id: input.command.approval_id,
            error: commandError,
          },
        }
    const processedAt = new Date()
    const updatedInboundMessage = await this.updateAgentMessages(
      {
        error: commandError,
        id: inboundMessage.id,
        processed_at: processedAt,
        status: accepted ? "PROCESSED" : "REJECTED",
      },
      sharedContext
    )
    const responseMessage = await this.createAgentMessages(
      {
        body: responseContent.body,
        channel: "IN_APP",
        conversation_id: conversation.id,
        direction: "OUTBOUND",
        idempotency_key: responseIdempotencyKey,
        message_type: "COMMAND_RESULT",
        occurred_at: processedAt,
        sender_id: "agent-operations",
        sender_type: "system",
        status: "AVAILABLE",
        structured_content: responseContent.structured_content,
      },
      sharedContext
    )

    await this.updateAgentConversations(
      { id: conversation.id, last_message_at: processedAt },
      sharedContext
    )
    await this.createAgentAuditEvents(
      {
        action: accepted
          ? "conversation-command-processed"
          : "conversation-command-rejected",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: incident.correlation_id,
        data: {
          accepted,
          approval_id: input.command.approval_id,
          client_message_id: input.client_message_id,
          command: input.command.name,
          error: commandError,
          message_id: inboundMessage.id,
        },
        event_type: accepted
          ? "agent.communication.command.processed"
          : "agent.communication.command.rejected",
        incident_id: incident.id,
        recorded_at: processedAt,
        resource_id: inboundMessage.id,
        resource_type: "agent_message",
      },
      sharedContext
    )

    return {
      accepted,
      command_result: responseContent.structured_content,
      conversation: await this.retrieveAgentConversation(
        conversation.id,
        {},
        sharedContext
      ),
      duplicate: false,
      inbound_message: updatedInboundMessage,
      response_message: responseMessage,
    }
  }

  @InjectManager()
  async decideApproval(
    input: ApprovalDecisionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.decideApproval_(input, sharedContext)
  }

  @InjectManager()
  async expireAgentApproval(
    input: { actor_id: string; approval_id: string; expired_at: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.expireAgentApproval_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async expireAgentApproval_(
    input: { actor_id: string; approval_id: string; expired_at: string },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const approval = await this.retrieveAgentApproval(
      input.approval_id,
      {},
      sharedContext
    )
    if (approval.status === "EXPIRED") {
      return { approval, duplicate: true, expired: true }
    }
    if (approval.status !== "PENDING") {
      return { approval, duplicate: false, expired: false }
    }

    const expiredAt = new Date(input.expired_at)
    if (new Date(approval.expires_at) > expiredAt) {
      return { approval, duplicate: false, expired: false }
    }

    const incident = await this.retrieveAgentIncident(
      approval.incident_id,
      {},
      sharedContext
    )
    const updated = await this.updateAgentApprovals(
      { id: approval.id, status: "EXPIRED" },
      sharedContext
    )
    await this.updateAgentRecommendations(
      { id: approval.recommendation_id, status: "EXPIRED" },
      sharedContext
    )
    if (incident.status === "AWAITING_APPROVAL") {
      assertIncidentTransition("AWAITING_APPROVAL", "ESCALATED")
      await this.updateAgentIncidents(
        {
          context: {
            approval_expired_at: expiredAt.toISOString(),
            approval_id: approval.id,
            previous_context: incident.context,
          },
          id: incident.id,
          status: "ESCALATED",
        },
        sharedContext
      )
    }
    await this.createAgentAuditEvents(
      {
        action: "approval-expired",
        actor_id: input.actor_id,
        actor_type: "system",
        correlation_id: incident.correlation_id,
        data: { expired_at: expiredAt.toISOString() },
        event_type: "agent.approval.expired",
        incident_id: incident.id,
        recorded_at: expiredAt,
        resource_id: approval.id,
        resource_type: "agent_approval",
      },
      sharedContext
    )
    await this.createAgentOutboxEvents(
      {
        aggregate_id: incident.id,
        aggregate_type: "agent_incident",
        available_at: expiredAt,
        event_type: "agent.approval.expired",
        event_version: 1,
        idempotency_key: `approval:${approval.id}:expired`,
        payload: {
          approval_id: approval.id,
          incident_id: incident.id,
          recommendation_id: approval.recommendation_id,
        },
        status: "PENDING",
      },
      sharedContext
    )
    return { approval: updated, duplicate: false, expired: true }
  }

  @InjectManager()
  async requestGovernedAgentAction(
    input: RequestAgentActionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.requestGovernedAgentAction_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async requestGovernedAgentAction_(
    input: RequestAgentActionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const existing = await this.listAgentActionRequests(
      { idempotency_key: input.idempotency_key },
      { take: 1 },
      sharedContext
    )

    if (existing[0]) {
      return { action: existing[0], duplicate: true }
    }

    const prepared = prepareAgentCommand<Record<string, unknown>>(
      AGENT_TOOL_REGISTRY,
      {
        authority: {
          actor_id: input.requested_by_id,
          approval_id: input.approval_id ?? null,
          granted_permissions: input.granted_permissions,
          granted_roles: input.granted_roles ?? [],
          idempotency_key: input.idempotency_key,
          mode: "ACTION_GATEWAY_REQUEST",
        },
        input: input.input,
        tool_name: input.tool_name,
        tool_version: input.tool_version,
      }
    )
    const now = new Date()
    const tenantId = input.tenant_id ?? "default"
    const declaredIncidentId = prepared.input.incident_id

    if (
      typeof declaredIncidentId === "string" &&
      declaredIncidentId !== input.incident_id
    ) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "Tool input incident_id must match the Action Gateway envelope."
      )
    }

    const activePolicyRecords = await this.listAgentPolicyDefinitions(
      {
        action_type: prepared.definition.name,
        status: "ACTIVE",
        tenant_id: tenantId,
      },
      {},
      sharedContext
    )
    const activePolicies = activePolicyRecords.filter(
      (policy) =>
        policy.effective_at <= now &&
        (!policy.expires_at || policy.expires_at > now)
    )
    const policyInput = prepared.input as Record<string, unknown>
    const policyDecision = evaluatePolicies(
      activePolicies.map((policy) => ({
        action_type: policy.action_type,
        conditions: (policy.conditions.all ?? []) as PolicyCondition[],
        policy_key: policy.policy_key,
        policy_version: policy.version,
        required_role: policy.required_role,
        requires_approval: policy.requires_approval,
        risk_level: policy.risk_level,
      })),
      prepared.definition.name,
      policyInput
    )
    const matchingPolicies = activePolicies.filter((policy) =>
      ((policy.conditions.all ?? []) as PolicyCondition[]).every((condition) =>
        conditionMatches(condition, policyInput)
      )
    )
    const riskRank = {
      HIGH: 3,
      LOW: 1,
      MEDIUM: 2,
      PROHIBITED: 4,
      READ_ONLY: 0,
    } as const
    const selectedPolicy = [...matchingPolicies].sort(
      (left, right) =>
        riskRank[right.risk_level] - riskRank[left.risk_level] ||
        left.policy_key.localeCompare(right.policy_key) ||
        left.version.localeCompare(right.version)
    )[0]

    if (!selectedPolicy || !policyDecision.allowed) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `No active policy allows agent tool ${prepared.definition.name}.`
      )
    }

    if (
      riskRank[policyDecision.risk_level] >
      riskRank[prepared.definition.risk_level]
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Policy risk ${policyDecision.risk_level} exceeds tool ceiling ${prepared.definition.risk_level}.`
      )
    }

    const requiresApproval =
      prepared.definition.approval_required || policyDecision.requires_approval
    let approval: Awaited<
      ReturnType<typeof this.retrieveAgentApproval>
    > | null = null

    if (requiresApproval) {
      if (!input.approval_id) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Agent tool ${prepared.definition.name} requires approval.`
        )
      }

      approval = await this.retrieveAgentApproval(
        input.approval_id,
        {},
        sharedContext
      )
      if (
        approval.status !== "APPROVED" ||
        new Date(approval.expires_at).getTime() <= now.getTime()
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Approval ${approval.id} is not usable.`
        )
      }
      if (input.incident_id && approval.incident_id !== input.incident_id) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          `Approval ${approval.id} does not belong to incident ${input.incident_id}.`
        )
      }
    }

    if (input.incident_id) {
      const incident = await this.retrieveAgentIncident(
        input.incident_id,
        {},
        sharedContext
      )
      if (incident.correlation_id !== input.correlation_id) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          `Incident ${incident.id} does not match correlation ${input.correlation_id}.`
        )
      }
    }

    if (input.recommendation_id) {
      const recommendation = await this.retrieveAgentRecommendation(
        input.recommendation_id,
        {},
        sharedContext
      )
      if (
        input.incident_id &&
        recommendation.incident_id !== input.incident_id
      ) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          `Recommendation ${recommendation.id} does not belong to incident ${input.incident_id}.`
        )
      }
    }

    const action = await this.createAgentActionRequests(
      {
        action_type: prepared.definition.name,
        approval_id: approval?.id,
        authorized_roles: { values: input.granted_roles ?? [] },
        available_at: now,
        correlation_id: input.correlation_id,
        idempotency_key: input.idempotency_key,
        incident_id: input.incident_id,
        input: prepared.input,
        permission: prepared.definition.permission,
        policy_key: selectedPolicy.policy_key,
        policy_version: selectedPolicy.version,
        recommendation_id: input.recommendation_id,
        requested_at: now,
        requested_by_id: input.requested_by_id,
        requested_by_type: input.requested_by_type,
        risk_level: policyDecision.risk_level,
        status: "PENDING",
        tenant_id: tenantId,
        tool_name: prepared.definition.name,
        tool_version: prepared.definition.version,
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "agent-action-requested",
        actor_id: input.requested_by_id,
        actor_type: input.requested_by_type,
        correlation_id: input.correlation_id,
        data: {
          approval_id: approval?.id,
          permission: prepared.definition.permission,
          policy_key: selectedPolicy.policy_key,
          policy_version: selectedPolicy.version,
          risk_level: policyDecision.risk_level,
          tool_name: prepared.definition.name,
          tool_version: prepared.definition.version,
        },
        event_type: "agent.action.requested",
        incident_id: input.incident_id,
        recorded_at: now,
        resource_id: action.id,
        resource_type: "agent_action_request",
      },
      sharedContext
    )
    await this.createAgentOutboxEvents(
      {
        aggregate_id: input.incident_id ?? action.id,
        aggregate_type: input.incident_id
          ? "agent_incident"
          : "agent_action_request",
        available_at: now,
        event_type: "agent.action.requested",
        event_version: 1,
        idempotency_key: `action:${action.id}:requested`,
        payload: {
          action_request_id: action.id,
          correlation_id: input.correlation_id,
          incident_id: input.incident_id,
          tool_name: action.tool_name,
        },
        status: "PENDING",
      },
      sharedContext
    )

    return { action, duplicate: false }
  }

  @InjectManager()
  async claimAgentAction(
    input: ClaimAgentActionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.claimAgentAction_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async claimAgentAction_(
    input: ClaimAgentActionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const action = await this.retrieveAgentActionRequest(
      input.action_request_id,
      {},
      sharedContext
    )
    const claimedAt = new Date(input.claimed_at)

    if (!isAgentActionClaimable(action, claimedAt)) {
      return {
        action,
        approval: null,
        claimed: false as const,
        duplicate:
          action.status === "SUCCEEDED" || action.status === "CONFLICT",
        incident: null,
        recommendation: null,
      }
    }

    const lockExpiresAt = new Date(
      claimedAt.getTime() + input.lease_duration_ms
    )
    const claimedActions = await this.updateAgentActionRequests(
      {
        data: {
          attempt_count: action.attempt_count + 1,
          last_error: null,
          lock_expires_at: lockExpiresAt,
          locked_at: claimedAt,
          locked_by: input.worker_id,
          status: "PROCESSING",
        },
        selector: {
          id: action.id,
          locked_by: action.locked_by,
          status: action.status,
        },
      },
      sharedContext
    )
    const claimedAction = claimedActions[0]

    if (!claimedAction) {
      return {
        action,
        approval: null,
        claimed: false as const,
        duplicate: false,
        incident: null,
        recommendation: null,
      }
    }

    const approval = claimedAction.approval_id
      ? await this.retrieveAgentApproval(
          claimedAction.approval_id,
          {},
          sharedContext
        )
      : null
    const incident = claimedAction.incident_id
      ? await this.retrieveAgentIncident(
          claimedAction.incident_id,
          {},
          sharedContext
        )
      : null
    const recommendation = claimedAction.recommendation_id
      ? await this.retrieveAgentRecommendation(
          claimedAction.recommendation_id,
          {},
          sharedContext
        )
      : null

    return {
      action: claimedAction,
      approval,
      claimed: true as const,
      duplicate: false,
      incident,
      recommendation,
    }
  }

  @InjectManager()
  async markAgentActionFailed(
    input: FailAgentActionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.markAgentActionFailed_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async markAgentActionFailed_(
    input: FailAgentActionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const action = await this.retrieveAgentActionRequest(
      input.action_request_id,
      {},
      sharedContext
    )

    if (
      action.status !== "PROCESSING" ||
      action.locked_by !== input.worker_id
    ) {
      return action
    }

    const failedAt = new Date(input.failed_at)
    const retry = calculateActionRetry(action.attempt_count, failedAt, input)
    const actions = await this.updateAgentActionRequests(
      {
        data: {
          available_at: retry.available_at,
          last_error: sanitizeOutboxError(input.error),
          lock_expires_at: null,
          locked_at: null,
          locked_by: null,
          status: retry.status,
        },
        selector: {
          id: action.id,
          locked_by: input.worker_id,
          status: "PROCESSING",
        },
      },
      sharedContext
    )

    const updatedAction = actions[0] ?? action

    if (actions[0] && retry.status === "DEAD") {
      const incident = action.incident_id
        ? await this.retrieveAgentIncident(
            action.incident_id,
            {},
            sharedContext
          )
        : null

      if (incident?.status === "EXECUTING") {
        assertIncidentTransition("EXECUTING", "ESCALATED")
        await this.updateAgentIncidents(
          {
            id: incident.id,
            context: {
              action_dead_letter: {
                action_request_id: action.id,
                error: updatedAction.last_error,
              },
              previous_context: incident.context,
            },
            status: "ESCALATED",
          },
          sharedContext
        )
      }

      if (action.recommendation_id) {
        await this.updateAgentRecommendations(
          { id: action.recommendation_id, status: "FAILED" },
          sharedContext
        )
      }
      await this.createAgentAuditEvents(
        {
          action: "agent-action-dead-lettered",
          actor_id: input.worker_id,
          actor_type: "worker",
          correlation_id: action.correlation_id,
          data: {
            action_request_id: action.id,
            attempt_count: updatedAction.attempt_count,
            error: updatedAction.last_error,
          },
          event_type: "agent.action.dead-lettered",
          incident_id: incident?.id,
          recorded_at: failedAt,
          resource_id: action.id,
          resource_type: "agent_action_request",
        },
        sharedContext
      )
      await this.createAgentOutboxEvents(
        {
          aggregate_id: incident?.id ?? action.id,
          aggregate_type: incident ? "agent_incident" : "agent_action_request",
          available_at: failedAt,
          event_type: "agent.action.dead-lettered",
          event_version: 1,
          idempotency_key: `action:${action.id}:dead`,
          payload: {
            action_request_id: action.id,
            attempt_count: updatedAction.attempt_count,
            error: updatedAction.last_error,
            incident_id: incident?.id,
          },
          status: "PENDING",
        },
        sharedContext
      )
    }

    return updatedAction
  }

  @InjectManager()
  async executeClaimedTaskAgentAction(
    input: {
      action_request_id: string
      actor_id: string
      actor_type: "user" | "worker"
      worker_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.executeClaimedTaskAgentAction_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async executeClaimedTaskAgentAction_(
    input: {
      action_request_id: string
      actor_id: string
      actor_type: "user" | "worker"
      worker_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const action = await this.retrieveAgentActionRequest(
      input.action_request_id,
      {},
      sharedContext
    )

    if (action.status === "SUCCEEDED" || action.status === "CONFLICT") {
      return {
        action,
        duplicate: true,
        result: action.result as TaskCommandOutput | null,
      }
    }

    if (
      action.status !== "PROCESSING" ||
      action.locked_by !== input.worker_id
    ) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Action ${action.id} is not leased by ${input.worker_id}.`
      )
    }

    const definition = AGENT_TOOL_REGISTRY[action.tool_name]
    if (
      !definition ||
      ![
        TASK_CREATE_TOOL.name,
        TASK_ASSIGN_TOOL.name,
        TASK_ESCALATE_TOOL.name,
      ].includes(action.tool_name as never) ||
      definition.version !== action.tool_version ||
      definition.permission !== action.permission
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Action ${action.id} does not reference a supported task tool contract.`
      )
    }

    const now = new Date()
    const policyRecords = await this.listAgentPolicyDefinitions(
      {
        policy_key: action.policy_key,
        status: "ACTIVE",
        tenant_id: action.tenant_id,
        version: action.policy_version,
      },
      { take: 1 },
      sharedContext
    )
    const policy = policyRecords[0]
    const policyConditions = (policy?.conditions.all ?? []) as PolicyCondition[]
    const actionPayload = action.input as Record<string, unknown>
    const policyIsUsable = Boolean(
      policy &&
      policy.action_type === action.tool_name &&
      policy.effective_at <= now &&
      (!policy.expires_at || policy.expires_at > now) &&
      policy.risk_level !== "PROHIBITED" &&
      policyConditions.every((condition) =>
        conditionMatches(condition, actionPayload)
      )
    )

    if (!policyIsUsable) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Action ${action.id} policy is no longer usable.`
      )
    }

    if (definition.approval_required || policy.requires_approval) {
      if (!action.approval_id) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Action ${action.id} requires approval.`
        )
      }
      const approval = await this.retrieveAgentApproval(
        action.approval_id,
        {},
        sharedContext
      )
      if (
        approval.status !== "APPROVED" ||
        new Date(approval.expires_at).getTime() <= now.getTime()
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Action ${action.id} approval is no longer usable.`
        )
      }
    }

    const authority = {
      action_request_id: action.id,
      actor_id: input.actor_id,
      approval_id: action.approval_id,
      granted_permissions: [action.permission],
      granted_roles: getAuthorizedRoles(action.authorized_roles),
      idempotency_key: action.idempotency_key,
      mode: "ACTION_GATEWAY" as const,
    }
    let result: TaskCommandOutput

    if (action.tool_name === TASK_CREATE_TOOL.name) {
      const execution = await executeAgentTool<
        TaskCreateInput,
        TaskCommandOutput
      >(
        AGENT_TOOL_REGISTRY,
        {
          authority,
          input: action.input,
          tool_name: action.tool_name,
          tool_version: action.tool_version,
        },
        async (taskInput) => {
          if (
            taskInput.incident_id &&
            taskInput.incident_id !== action.incident_id
          ) {
            throw new MedusaError(
              MedusaError.Types.CONFLICT,
              "Task incident does not match the action envelope."
            )
          }
          const created = await this.createGovernedAgentTask_(
            {
              ...taskInput,
              created_by_id: action.requested_by_id,
              created_by_type: action.requested_by_type as
                | "agent"
                | "system"
                | "user",
              idempotency_key: `action:${action.id}:task.create`,
            },
            sharedContext
          )

          return {
            duplicate: created.duplicate,
            outcome: "SUCCEEDED",
            task: toGovernedTaskSnapshot(created.task),
          }
        }
      )
      result = execution.output
    } else if (action.tool_name === TASK_ASSIGN_TOOL.name) {
      const execution = await executeAgentTool<
        TaskAssignInput,
        TaskCommandOutput
      >(
        AGENT_TOOL_REGISTRY,
        {
          authority,
          input: action.input,
          tool_name: action.tool_name,
          tool_version: action.tool_version,
        },
        async (taskInput) => {
          const task = await this.retrieveAgentTask(
            taskInput.task_id,
            {},
            sharedContext
          )

          if (task.status !== taskInput.expected_status) {
            return {
              code: "TASK_STATE_CONFLICT",
              message: `Task ${task.id} is ${task.status}, expected ${taskInput.expected_status}.`,
              outcome: "CONFLICT",
              task: toGovernedTaskSnapshot(task),
            }
          }

          if (
            task.status === "CLAIMED" &&
            task.assigned_to_id === taskInput.assigned_to_id &&
            task.assigned_to_type === taskInput.assigned_to_type
          ) {
            return {
              duplicate: true,
              outcome: "SUCCEEDED",
              task: toGovernedTaskSnapshot(task),
            }
          }

          if (task.status === "TODO") {
            assertAgentTaskTransition("TODO", "CLAIMED")
          }
          const assigned = await this.updateAgentTasks(
            {
              assigned_to_id: taskInput.assigned_to_id,
              assigned_to_type: taskInput.assigned_to_type,
              claimed_at: task.claimed_at ?? now,
              id: task.id,
              status: "CLAIMED",
            },
            sharedContext
          )
          await this.createAgentAuditEvents(
            {
              action: "task-assigned",
              actor_id: action.requested_by_id,
              actor_type: action.requested_by_type,
              correlation_id: task.incident_id ?? action.correlation_id,
              data: {
                assigned_to_id: taskInput.assigned_to_id,
                assigned_to_type: taskInput.assigned_to_type,
              },
              event_type: "agent.task.assigned",
              incident_id: task.incident_id,
              recorded_at: now,
              resource_id: task.id,
              resource_type: "agent_task",
            },
            sharedContext
          )

          return {
            duplicate: false,
            outcome: "SUCCEEDED",
            task: toGovernedTaskSnapshot(assigned),
          }
        }
      )
      result = execution.output
    } else {
      const execution = await executeAgentTool<
        TaskEscalateInput,
        TaskCommandOutput
      >(
        AGENT_TOOL_REGISTRY,
        {
          authority,
          input: action.input,
          tool_name: action.tool_name,
          tool_version: action.tool_version,
        },
        async (taskInput) => {
          const escalated = await this.escalateGovernedAgentTask_(
            {
              ...taskInput,
              actor_id: action.requested_by_id,
            },
            sharedContext
          )

          if (escalated.outcome === "CONFLICT") {
            return {
              code: escalated.code,
              message: escalated.message,
              outcome: "CONFLICT",
              task: toGovernedTaskSnapshot(escalated.task),
            }
          }

          return {
            duplicate: false,
            outcome: "SUCCEEDED",
            task: toGovernedTaskSnapshot(escalated.task),
          }
        }
      )
      result = execution.output
    }

    const completedAt = new Date()
    const updatedActions = await this.updateAgentActionRequests(
      {
        data: {
          completed_at: completedAt,
          last_error: result.outcome === "CONFLICT" ? result.message : null,
          lock_expires_at: null,
          locked_at: null,
          locked_by: null,
          result,
          status: result.outcome,
        },
        selector: {
          id: action.id,
          locked_by: input.worker_id,
          status: "PROCESSING",
        },
      },
      sharedContext
    )
    const updatedAction = updatedActions[0]

    if (!updatedAction) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Action ${action.id} lost its execution lease.`
      )
    }

    await this.createAgentToolCalls(
      {
        action_request_id: action.id,
        completed_at: completedAt,
        error: result.outcome === "CONFLICT" ? result.message : null,
        idempotency_key: `action:${action.id}:${action.tool_name}:1`,
        incident_id: action.incident_id,
        input: actionPayload,
        kind: "COMMAND",
        output: result,
        started_at: action.locked_at ?? completedAt,
        status: result.outcome,
        tool_name: action.tool_name,
        tool_version: action.tool_version,
      },
      sharedContext
    )
    const eventType =
      result.outcome === "SUCCEEDED"
        ? "agent.action.executed"
        : "agent.action.conflicted"
    await this.createAgentAuditEvents(
      {
        action:
          result.outcome === "SUCCEEDED"
            ? "agent-action-executed"
            : "agent-action-conflicted",
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        correlation_id: action.correlation_id,
        data: { result, tool_name: action.tool_name },
        event_type: eventType,
        incident_id: action.incident_id,
        recorded_at: completedAt,
        resource_id: action.id,
        resource_type: "agent_action_request",
      },
      sharedContext
    )
    await this.createAgentOutboxEvents(
      {
        aggregate_id: action.incident_id ?? action.id,
        aggregate_type: action.incident_id
          ? "agent_incident"
          : "agent_action_request",
        available_at: completedAt,
        event_type: eventType,
        event_version: 1,
        idempotency_key: `action:${action.id}:${result.outcome}`,
        payload: {
          action_request_id: action.id,
          correlation_id: action.correlation_id,
          incident_id: action.incident_id,
          result,
          tool_name: action.tool_name,
        },
        status: "PENDING",
      },
      sharedContext
    )

    return { action: updatedAction, duplicate: false, result }
  }

  @InjectManager()
  async executeClaimedPlatformAgentAction(
    input: {
      action_request_id: string
      actor_id: string
      actor_type: "user" | "worker"
      worker_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.executeClaimedPlatformAgentAction_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async executeClaimedPlatformAgentAction_(
    input: {
      action_request_id: string
      actor_id: string
      actor_type: "user" | "worker"
      worker_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const action = await this.retrieveAgentActionRequest(
      input.action_request_id,
      {},
      sharedContext
    )
    if (action.status === "SUCCEEDED" || action.status === "CONFLICT") {
      return {
        action,
        duplicate: true,
        result: action.result as PlatformCommandOutput | null,
      }
    }
    if (
      action.status !== "PROCESSING" ||
      action.locked_by !== input.worker_id
    ) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Action ${action.id} is not leased by ${input.worker_id}.`
      )
    }

    const supportedTools = [
      APPROVAL_DECIDE_TOOL.name,
      APPROVAL_REQUEST_TOOL.name,
      INCIDENT_CREATE_TOOL.name,
      INCIDENT_UPDATE_TOOL.name,
      KNOWLEDGE_PROPOSE_TOOL.name,
      MESSAGE_SEND_TOOL.name,
    ] as string[]
    const definition = AGENT_TOOL_REGISTRY[action.tool_name]
    if (
      !definition ||
      !supportedTools.includes(action.tool_name) ||
      definition.version !== action.tool_version ||
      definition.permission !== action.permission
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Action ${action.id} does not reference a supported platform tool contract.`
      )
    }

    const now = new Date()
    const policy = (
      await this.listAgentPolicyDefinitions(
        {
          policy_key: action.policy_key,
          status: "ACTIVE",
          tenant_id: action.tenant_id,
          version: action.policy_version,
        },
        { take: 1 },
        sharedContext
      )
    )[0]
    const policyConditions = (policy?.conditions.all ?? []) as PolicyCondition[]
    if (
      !policy ||
      policy.action_type !== action.tool_name ||
      policy.effective_at > now ||
      (policy.expires_at && policy.expires_at <= now) ||
      policy.risk_level === "PROHIBITED" ||
      !policyConditions.every((condition) =>
        conditionMatches(condition, action.input as Record<string, unknown>)
      )
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Action ${action.id} policy is no longer usable.`
      )
    }

    const execution = await executeAgentTool<
      Record<string, unknown>,
      PlatformCommandOutput
    >(
      AGENT_TOOL_REGISTRY,
      {
        authority: {
          action_request_id: action.id,
          actor_id: input.actor_id,
          approval_id: action.approval_id,
          granted_permissions: [action.permission],
          granted_roles: getAuthorizedRoles(action.authorized_roles),
          idempotency_key: action.idempotency_key,
          mode: "ACTION_GATEWAY",
        },
        input: action.input,
        tool_name: action.tool_name,
        tool_version: action.tool_version,
      },
      async (toolInput) => {
        if (action.tool_name === INCIDENT_CREATE_TOOL.name) {
          const event = await this.retrieveAgentEvent(
            String(toolInput.trigger_event_id),
            {},
            sharedContext
          )
          if (
            event.correlation_id !== action.correlation_id ||
            event.tenant_id !== action.tenant_id ||
            event.subject_id !== toolInput.subject_id ||
            event.subject_type !== toolInput.subject_type
          ) {
            return platformConflict(
              "INCIDENT_EVENT_CONFLICT",
              "Canonical event does not match the action envelope."
            )
          }
          const existing = (
            await this.listAgentIncidents(
              { trigger_event_id: event.id },
              { take: 1 },
              sharedContext
            )
          )[0]
          const incident =
            existing ??
            (await this.createAgentIncidents(
              {
                context: toolInput.context as
                  | Record<string, unknown>
                  | undefined,
                correlation_id: action.correlation_id,
                incident_type: String(toolInput.incident_type),
                priority: toolInput.priority as
                  | "LOW"
                  | "MEDIUM"
                  | "HIGH"
                  | "CRITICAL",
                status: "RECEIVED",
                subject_id: String(toolInput.subject_id),
                subject_type: String(toolInput.subject_type),
                summary: toolInput.summary as string | undefined,
                tenant_id: action.tenant_id,
                title: String(toolInput.title),
                trigger_event_id: event.id,
              },
              sharedContext
            ))
          return platformIncidentResult(incident, Boolean(existing))
        }

        if (action.tool_name === INCIDENT_UPDATE_TOOL.name) {
          const incident = await this.retrieveAgentIncident(
            String(toolInput.incident_id),
            {},
            sharedContext
          )
          if (
            incident.id !== action.incident_id ||
            incident.status !== toolInput.expected_status
          ) {
            return platformConflict(
              "INCIDENT_STATE_CONFLICT",
              `Incident ${incident.id} is ${incident.status}, expected ${toolInput.expected_status}.`
            )
          }
          const status = toolInput.status as IncidentStatus
          if (
            status !== incident.status &&
            !canTransitionIncident(incident.status as IncidentStatus, status)
          ) {
            return platformConflict(
              "INCIDENT_STATE_CONFLICT",
              `Incident cannot transition from ${incident.status} to ${status}.`
            )
          }
          if (status === "RESOLVED" && !toolInput.resolution) {
            return platformConflict(
              "INCIDENT_STATE_CONFLICT",
              "A resolved incident requires a resolution summary."
            )
          }
          const updated = await this.updateAgentIncidents(
            {
              context:
                (toolInput.context as Record<string, unknown> | undefined) ??
                (incident.context as Record<string, unknown> | null),
              id: incident.id,
              owner_id:
                (toolInput.owner_id as string | undefined) ?? incident.owner_id,
              resolution: toolInput.resolution
                ? { summary: toolInput.resolution }
                : (incident.resolution as Record<string, unknown> | null),
              resolved_at: status === "RESOLVED" ? now : incident.resolved_at,
              status,
              summary:
                (toolInput.summary as string | undefined) ?? incident.summary,
            },
            sharedContext
          )
          return platformIncidentResult(updated, false)
        }

        if (action.tool_name === APPROVAL_REQUEST_TOOL.name) {
          return this.requestApprovalFromTool_(
            action,
            toolInput,
            now,
            sharedContext
          )
        }

        if (action.tool_name === APPROVAL_DECIDE_TOOL.name) {
          const decision = await this.decideApproval_(
            {
              actor_id: action.requested_by_id,
              approval_id: String(toolInput.approval_id),
              decision: toolInput.decision as "APPROVED" | "REJECTED",
              reason: String(toolInput.reason),
            },
            sharedContext
          )
          if ("conflict" in decision) {
            return platformConflict(
              String(decision.conflict),
              `Approval decision failed: ${decision.conflict}.`
            )
          }
          return {
            approval_id: decision.approval.id,
            duplicate: decision.duplicate,
            outcome: "SUCCEEDED" as const,
            status: decision.approval.status as "APPROVED" | "REJECTED",
          }
        }

        if (action.tool_name === KNOWLEDGE_PROPOSE_TOOL.name) {
          const created = await this.createGovernedKnowledgeDocument_(
            {
              citation_locator: String(toolInput.citation_locator),
              content: String(toolInput.content),
              document_key: String(toolInput.document_key),
              effective_at: String(toolInput.effective_at),
              expires_at: toolInput.expires_at as string | undefined,
              locale: String(toolInput.locale),
              owner_id: action.requested_by_id,
              scope: String(toolInput.scope),
              tenant_id: String(toolInput.tenant_id),
              title: String(toolInput.title),
              version: String(toolInput.version),
            },
            sharedContext
          )
          return {
            document_id: created.document.id,
            duplicate: created.duplicate,
            outcome: "SUCCEEDED" as const,
            status: "DRAFT" as const,
          }
        }

        const conversation = await this.retrieveAgentConversation(
          String(toolInput.conversation_id),
          {},
          sharedContext
        )
        if (conversation.status !== "OPEN") {
          return platformConflict(
            "CONVERSATION_STATE_CONFLICT",
            `Conversation ${conversation.id} is closed.`
          )
        }
        const conversationMetadata = (conversation.metadata ?? {}) as Record<
          string,
          unknown
        >
        let externalConnection:
          | Awaited<
              ReturnType<
                AgentOperationsModuleService["retrieveAgentChannelConnection"]
              >
            >
          | undefined
        if (conversation.channel !== "IN_APP") {
          const connectionId = conversationMetadata.connection_id
          if (typeof connectionId !== "string") {
            return platformConflict(
              "CHANNEL_CONNECTION_MISSING",
              `Conversation ${conversation.id} has no channel connection.`
            )
          }
          externalConnection = await this.retrieveAgentChannelConnection(
            connectionId,
            {},
            sharedContext
          )
          if (
            externalConnection.status !== "ACTIVE" ||
            externalConnection.channel !== conversation.channel ||
            !conversation.external_thread_id
          ) {
            return platformConflict(
              "CHANNEL_CONNECTION_UNAVAILABLE",
              `Conversation ${conversation.id} cannot deliver on its configured channel.`
            )
          }
        }
        const message = await this.createAgentMessages(
          {
            body: String(toolInput.body),
            channel: conversation.channel,
            conversation_id: conversation.id,
            direction: "OUTBOUND",
            idempotency_key: `action:${action.id}:message.send`,
            message_type: toolInput.message_type as "TEXT" | "NOTIFICATION",
            occurred_at: now,
            sender_id: action.requested_by_id,
            sender_type: action.requested_by_type,
            status: "AVAILABLE",
            structured_content: toolInput.structured_content as
              | Record<string, unknown>
              | undefined,
          },
          sharedContext
        )
        await this.updateAgentConversations(
          { id: conversation.id, last_message_at: now },
          sharedContext
        )
        const delivery = externalConnection
          ? await this.createAgentDeliveries(
              {
                attempt_count: 0,
                available_at: now,
                channel: conversation.channel,
                connection_id: externalConnection.id,
                idempotency_key: `message:${message.id}:delivery`,
                message_id: message.id,
                status: "PENDING",
              },
              sharedContext
            )
          : undefined
        return {
          delivery_id: delivery?.id,
          duplicate: false,
          message_id: message.id,
          outcome: "SUCCEEDED" as const,
          status: "AVAILABLE" as const,
        }
      }
    )

    const result = execution.output
    const completedAt = new Date()
    const updatedAction = (
      await this.updateAgentActionRequests(
        {
          data: {
            completed_at: completedAt,
            last_error: result.outcome === "CONFLICT" ? result.message : null,
            lock_expires_at: null,
            locked_at: null,
            locked_by: null,
            result,
            status: result.outcome,
          },
          selector: {
            id: action.id,
            locked_by: input.worker_id,
            status: "PROCESSING",
          },
        },
        sharedContext
      )
    )[0]
    if (!updatedAction) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Action ${action.id} lost its execution lease.`
      )
    }
    await this.createAgentToolCalls(
      {
        action_request_id: action.id,
        completed_at: completedAt,
        error: result.outcome === "CONFLICT" ? result.message : null,
        idempotency_key: `action:${action.id}:${action.tool_name}:1`,
        incident_id: action.incident_id,
        input: action.input as Record<string, unknown>,
        kind: "COMMAND",
        output: result,
        started_at: action.locked_at ?? completedAt,
        status: result.outcome,
        tool_name: action.tool_name,
        tool_version: action.tool_version,
      },
      sharedContext
    )
    const eventType =
      result.outcome === "SUCCEEDED"
        ? "agent.action.executed"
        : "agent.action.conflicted"
    await this.createAgentAuditEvents(
      {
        action:
          result.outcome === "SUCCEEDED"
            ? "agent-action-executed"
            : "agent-action-conflicted",
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        correlation_id: action.correlation_id,
        data: { result, tool_name: action.tool_name },
        event_type: eventType,
        incident_id: action.incident_id,
        recorded_at: completedAt,
        resource_id: action.id,
        resource_type: "agent_action_request",
      },
      sharedContext
    )
    await this.createAgentOutboxEvents(
      {
        aggregate_id: action.incident_id ?? action.id,
        aggregate_type: action.incident_id
          ? "agent_incident"
          : "agent_action_request",
        available_at: completedAt,
        event_type: eventType,
        event_version: 1,
        idempotency_key: `action:${action.id}:${result.outcome}`,
        payload: {
          action_request_id: action.id,
          result,
          tool_name: action.tool_name,
        },
        status: "PENDING",
      },
      sharedContext
    )
    return { action: updatedAction, duplicate: false, result }
  }

  @InjectTransactionManager()
  private async requestApprovalFromTool_(
    action: Awaited<ReturnType<typeof this.retrieveAgentActionRequest>>,
    toolInput: Record<string, unknown>,
    now: Date,
    @MedusaContext() sharedContext: Context
  ): Promise<PlatformCommandOutput> {
    const incident = await this.retrieveAgentIncident(
      String(toolInput.incident_id),
      {},
      sharedContext
    )
    const recommendation = await this.retrieveAgentRecommendation(
      String(toolInput.recommendation_id),
      {},
      sharedContext
    )
    if (
      incident.id !== action.incident_id ||
      recommendation.incident_id !== incident.id
    ) {
      return platformConflict(
        "APPROVAL_STATE_CONFLICT",
        "Recommendation, incident, and action envelope do not match."
      )
    }
    const existing = (
      await this.listAgentApprovals(
        { recommendation_id: recommendation.id },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (existing) {
      if (!["PENDING", "APPROVED", "REJECTED"].includes(existing.status)) {
        return platformConflict(
          "APPROVAL_STATE_CONFLICT",
          `Existing approval is ${existing.status}.`
        )
      }
      return {
        approval_id: existing.id,
        duplicate: true,
        outcome: "SUCCEEDED",
        status: existing.status as "PENDING" | "APPROVED" | "REJECTED",
      }
    }
    if (
      incident.status !== "OPTIONS_READY" ||
      recommendation.status !== "PROPOSED"
    ) {
      return platformConflict(
        "APPROVAL_STATE_CONFLICT",
        "Incident or recommendation is not ready for approval."
      )
    }
    const targetPolicy = (
      await this.listAgentPolicyDefinitions(
        {
          policy_key: String(toolInput.policy_key),
          status: "ACTIVE",
          tenant_id: action.tenant_id,
          version: String(toolInput.policy_version),
        },
        { take: 1 },
        sharedContext
      )
    )[0]
    if (
      !targetPolicy ||
      targetPolicy.required_role !== toolInput.required_role ||
      targetPolicy.action_type !== recommendation.action_type ||
      targetPolicy.effective_at > now ||
      (targetPolicy.expires_at && targetPolicy.expires_at <= now) ||
      new Date(String(toolInput.expires_at)) <= now
    ) {
      return platformConflict(
        "APPROVAL_STATE_CONFLICT",
        "Target action policy is not active for the requested role."
      )
    }
    const approval = await this.createAgentApprovals(
      {
        expires_at: new Date(String(toolInput.expires_at)),
        incident_id: incident.id,
        policy_key: String(toolInput.policy_key),
        policy_version: String(toolInput.policy_version),
        recommendation_id: recommendation.id,
        requested_at: now,
        requested_by_id: action.requested_by_id,
        requested_by_type: action.requested_by_type,
        required_role: String(toolInput.required_role),
        status: "PENDING",
      },
      sharedContext
    )
    await this.updateAgentRecommendations(
      { id: recommendation.id, status: "PENDING_APPROVAL" },
      sharedContext
    )
    assertIncidentTransition("OPTIONS_READY", "AWAITING_APPROVAL")
    await this.updateAgentIncidents(
      { id: incident.id, status: "AWAITING_APPROVAL" },
      sharedContext
    )
    await this.createAgentOutboxEvents(
      {
        aggregate_id: incident.id,
        aggregate_type: "agent_incident",
        available_at: now,
        event_type: "agent.approval.requested",
        event_version: 1,
        idempotency_key: `approval:${approval.id}:requested`,
        payload: {
          approval_id: approval.id,
          incident_id: incident.id,
          recommendation_id: recommendation.id,
        },
        status: "PENDING",
      },
      sharedContext
    )
    return {
      approval_id: approval.id,
      duplicate: false,
      outcome: "SUCCEEDED",
      status: "PENDING",
    }
  }

  @InjectManager()
  async finalizeAgentAction(
    input: {
      action_request_id: string
      actor_id: string
      actor_type: "user" | "worker"
      completed_at: string
      outcome: "SUCCEEDED" | "CONFLICT"
      result: Record<string, unknown>
      worker_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.finalizeAgentAction_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async finalizeAgentAction_(
    input: {
      action_request_id: string
      actor_id: string
      actor_type: "user" | "worker"
      completed_at: string
      outcome: "SUCCEEDED" | "CONFLICT"
      result: Record<string, unknown>
      worker_id: string
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const action = await this.retrieveAgentActionRequest(
      input.action_request_id,
      {},
      sharedContext
    )

    if (action.status === "SUCCEEDED" || action.status === "CONFLICT") {
      return { action, duplicate: true }
    }

    if (
      action.status !== "PROCESSING" ||
      action.locked_by !== input.worker_id
    ) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Action ${action.id} is not leased by ${input.worker_id}.`
      )
    }

    if (!action.incident_id || !action.recommendation_id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Inventory action ${action.id} is missing incident or recommendation context.`
      )
    }

    const now = new Date(input.completed_at)
    const incident = await this.retrieveAgentIncident(
      action.incident_id,
      {},
      sharedContext
    )
    assertIncidentTransition(
      incident.status as IncidentStatus,
      input.outcome === "SUCCEEDED" ? "MONITORING" : "OPTIONS_READY"
    )

    const updatedActions = await this.updateAgentActionRequests(
      {
        data: {
          completed_at: now,
          last_error:
            input.outcome === "CONFLICT"
              ? String(input.result.message ?? "Action conflict")
              : null,
          lock_expires_at: null,
          locked_at: null,
          locked_by: null,
          result: input.result,
          status: input.outcome,
        },
        selector: {
          id: action.id,
          locked_by: input.worker_id,
          status: "PROCESSING",
        },
      },
      sharedContext
    )
    const updatedAction = updatedActions[0]

    if (!updatedAction) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Action ${action.id} lost its execution lease.`
      )
    }

    const positionsBefore = input.result.positions_before

    if (positionsBefore) {
      await this.createAgentToolCalls(
        {
          action_request_id: action.id,
          completed_at: now,
          error: null,
          idempotency_key: `action:${action.id}:inventory.get-position:1`,
          incident_id: action.incident_id,
          input: {
            inventory_item_id: (action.input as Record<string, unknown>)
              .inventory_item_id,
            location_ids: [
              (action.input as Record<string, unknown>).source_location_id,
              (action.input as Record<string, unknown>).target_location_id,
            ],
          },
          kind: "READ",
          output: { positions: positionsBefore },
          started_at: action.locked_at ?? now,
          status: "SUCCEEDED",
          tool_name: "inventory.get-position",
          tool_version: "1.0.0",
        },
        sharedContext
      )
    }

    await this.createAgentToolCalls(
      {
        action_request_id: action.id,
        completed_at: now,
        error:
          input.outcome === "CONFLICT"
            ? String(input.result.message ?? "Action conflict")
            : null,
        idempotency_key: `action:${action.id}:inventory.execute-transfer:1`,
        incident_id: action.incident_id,
        input: action.input as Record<string, unknown>,
        kind: "COMMAND",
        output: { result: input.result },
        started_at: action.locked_at ?? now,
        status: input.outcome,
        tool_name: action.tool_name,
        tool_version: action.tool_version,
      },
      sharedContext
    )

    await this.updateAgentRecommendations(
      {
        id: action.recommendation_id,
        status: input.outcome === "SUCCEEDED" ? "EXECUTED" : "FAILED",
      },
      sharedContext
    )

    if (input.outcome === "SUCCEEDED") {
      await this.updateAgentIncidents(
        { id: incident.id, status: "MONITORING" },
        sharedContext
      )
      assertIncidentTransition("MONITORING", "RESOLVED")
      await this.updateAgentIncidents(
        {
          id: incident.id,
          resolution: {
            action_request_id: action.id,
            result: input.result,
          },
          resolved_at: now,
          status: "RESOLVED",
        },
        sharedContext
      )
    } else {
      await this.updateAgentIncidents(
        {
          id: incident.id,
          context: {
            action_conflict: input.result,
            previous_context: incident.context,
          },
          status: "OPTIONS_READY",
        },
        sharedContext
      )
    }

    const eventType =
      input.outcome === "SUCCEEDED"
        ? "agent.action.executed"
        : "agent.action.conflicted"
    await this.createAgentAuditEvents(
      {
        action:
          input.outcome === "SUCCEEDED"
            ? "inventory-transfer-executed"
            : "inventory-transfer-conflicted",
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        correlation_id: incident.correlation_id,
        data: input.result,
        event_type: eventType,
        incident_id: incident.id,
        recorded_at: now,
        resource_id: action.id,
        resource_type: "agent_action_request",
      },
      sharedContext
    )
    await this.createAgentOutboxEvents(
      {
        aggregate_id: incident.id,
        aggregate_type: "agent_incident",
        available_at: now,
        event_type: eventType,
        event_version: 1,
        idempotency_key: `action:${action.id}:${input.outcome}`,
        payload: {
          action_request_id: action.id,
          incident_id: incident.id,
          outcome: input.outcome,
          result: input.result,
        },
        status: "PENDING",
      },
      sharedContext
    )

    return { action: updatedAction, duplicate: false }
  }

  @InjectManager()
  async claimAgentOutboxEvent(
    input: ClaimAgentOutboxEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.claimAgentOutboxEvent_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async claimAgentOutboxEvent_(
    input: ClaimAgentOutboxEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const event = await this.retrieveAgentOutboxEvent(
      input.event_id,
      {},
      sharedContext
    )
    const claimedAt = new Date(input.claimed_at)

    if (!isOutboxEventClaimable(event, claimedAt)) {
      return { claimed: false as const, event: null }
    }

    const lockExpiresAt = new Date(
      claimedAt.getTime() + input.lease_duration_ms
    )
    const claimedEvents = await this.updateAgentOutboxEvents(
      {
        data: {
          attempt_count: event.attempt_count + 1,
          last_error: null,
          lock_expires_at: lockExpiresAt,
          locked_at: claimedAt,
          locked_by: input.worker_id,
          status: "PROCESSING",
        },
        selector: {
          id: event.id,
          locked_by: event.locked_by,
          status: event.status,
        },
      },
      sharedContext
    )
    const claimedEvent = claimedEvents[0]

    if (!claimedEvent) {
      return { claimed: false as const, event: null }
    }

    return { claimed: true as const, event: claimedEvent }
  }

  @InjectManager()
  async markAgentOutboxEventDelivered(
    input: CompleteAgentOutboxEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.markAgentOutboxEventDelivered_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async markAgentOutboxEventDelivered_(
    input: CompleteAgentOutboxEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const events = await this.updateAgentOutboxEvents(
      {
        data: {
          delivered_at: new Date(input.completed_at),
          last_error: null,
          lock_expires_at: null,
          locked_at: null,
          locked_by: null,
          status: "DELIVERED",
        },
        selector: {
          id: input.event_id,
          locked_by: input.worker_id,
          status: "PROCESSING",
        },
      },
      sharedContext
    )

    if (!events[0]) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Outbox event ${input.event_id} is not leased by ${input.worker_id}.`
      )
    }

    return events[0]
  }

  @InjectManager()
  async markAgentOutboxEventFailed(
    input: FailAgentOutboxEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.markAgentOutboxEventFailed_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async markAgentOutboxEventFailed_(
    input: FailAgentOutboxEventInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const event = await this.retrieveAgentOutboxEvent(
      input.event_id,
      {},
      sharedContext
    )

    if (event.status !== "PROCESSING" || event.locked_by !== input.worker_id) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Outbox event ${input.event_id} is not leased by ${input.worker_id}.`
      )
    }

    const failedAt = new Date(input.failed_at)
    const retry = calculateOutboxRetry(event.attempt_count, failedAt, input)
    const events = await this.updateAgentOutboxEvents(
      {
        data: {
          available_at: retry.available_at,
          last_error: sanitizeOutboxError(input.error),
          lock_expires_at: null,
          locked_at: null,
          locked_by: null,
          status: retry.status,
        },
        selector: {
          id: event.id,
          locked_by: input.worker_id,
          status: "PROCESSING",
        },
      },
      sharedContext
    )

    if (!events[0]) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Outbox event ${input.event_id} lost its lease before failure handling.`
      )
    }

    return events[0]
  }

  @InjectManager()
  async claimAgentDelivery(
    input: ClaimAgentDeliveryInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.claimAgentDelivery_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async claimAgentDelivery_(
    input: ClaimAgentDeliveryInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const delivery = await this.retrieveAgentDelivery(
      input.delivery_id,
      {},
      sharedContext
    )
    const claimedAt = new Date(input.claimed_at)
    if (!isAgentDeliveryClaimable(delivery, claimedAt)) {
      return { claimed: false as const, delivery: null }
    }

    const claimed = (
      await this.updateAgentDeliveries(
        {
          data: {
            attempt_count: delivery.attempt_count + 1,
            last_error: null,
            lock_expires_at: new Date(
              claimedAt.getTime() + input.lease_duration_ms
            ),
            locked_at: claimedAt,
            locked_by: input.worker_id,
            status: "PROCESSING",
          },
          selector: {
            id: delivery.id,
            locked_by: delivery.locked_by,
            status: delivery.status,
          },
        },
        sharedContext
      )
    )[0]

    return claimed
      ? { claimed: true as const, delivery: claimed }
      : { claimed: false as const, delivery: null }
  }

  @InjectManager()
  async markAgentDeliveryDelivered(
    input: CompleteAgentDeliveryInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.markAgentDeliveryDelivered_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async markAgentDeliveryDelivered_(
    input: CompleteAgentDeliveryInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const deliveredAt = new Date(input.completed_at)
    const delivery = (
      await this.updateAgentDeliveries(
        {
          data: {
            delivered_at: deliveredAt,
            external_message_id: input.external_message_id,
            last_error: null,
            lock_expires_at: null,
            locked_at: null,
            locked_by: null,
            status: "DELIVERED",
          },
          selector: {
            id: input.delivery_id,
            locked_by: input.worker_id,
            status: "PROCESSING",
          },
        },
        sharedContext
      )
    )[0]
    if (!delivery) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Delivery ${input.delivery_id} is not leased by ${input.worker_id}.`
      )
    }

    await this.updateAgentMessages(
      {
        external_message_id: input.external_message_id,
        id: delivery.message_id,
        processed_at: deliveredAt,
        status: "PROCESSED",
      },
      sharedContext
    )

    return delivery
  }

  @InjectManager()
  async markAgentDeliveryFailed(
    input: FailAgentDeliveryInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return this.markAgentDeliveryFailed_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async markAgentDeliveryFailed_(
    input: FailAgentDeliveryInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const delivery = await this.retrieveAgentDelivery(
      input.delivery_id,
      {},
      sharedContext
    )
    if (
      delivery.status !== "PROCESSING" ||
      delivery.locked_by !== input.worker_id
    ) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Delivery ${input.delivery_id} is not leased by ${input.worker_id}.`
      )
    }

    const failedAt = new Date(input.failed_at)
    const retry = calculateDeliveryRetry(
      delivery.attempt_count,
      failedAt,
      input
    )
    const failed = (
      await this.updateAgentDeliveries(
        {
          data: {
            available_at: retry.available_at,
            last_error: sanitizeOutboxError(input.error),
            lock_expires_at: null,
            locked_at: null,
            locked_by: null,
            status: retry.status,
          },
          selector: {
            id: delivery.id,
            locked_by: input.worker_id,
            status: "PROCESSING",
          },
        },
        sharedContext
      )
    )[0]
    if (!failed) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Delivery ${input.delivery_id} lost its lease before failure handling.`
      )
    }

    if (failed.status === "DEAD") {
      await this.updateAgentMessages(
        {
          error: failed.last_error,
          id: failed.message_id,
          processed_at: failedAt,
          status: "REJECTED",
        },
        sharedContext
      )
    }

    return failed
  }

  @InjectTransactionManager()
  protected async decideApproval_(
    input: ApprovalDecisionInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const approval = await this.retrieveAgentApproval(
      input.approval_id,
      {},
      sharedContext
    )

    if (approval.status !== "PENDING") {
      if (approval.status === input.decision) {
        return {
          action_request: await this.findActionRequestForApproval(
            approval.id,
            sharedContext
          ),
          approval,
          duplicate: true,
        }
      }

      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Approval ${approval.id} has already been decided as ${approval.status}.`
      )
    }

    const now = new Date()

    if (new Date(approval.expires_at).getTime() <= now.getTime()) {
      const expiredApproval = await this.updateAgentApprovals(
        { id: approval.id, status: "EXPIRED" },
        sharedContext
      )
      await this.updateAgentRecommendations(
        { id: approval.recommendation_id, status: "EXPIRED" },
        sharedContext
      )
      const incident = await this.retrieveAgentIncident(
        approval.incident_id,
        {},
        sharedContext
      )
      assertIncidentTransition(incident.status as IncidentStatus, "ESCALATED")
      await this.updateAgentIncidents(
        { id: incident.id, status: "ESCALATED" },
        sharedContext
      )

      return {
        approval: expiredApproval,
        conflict: "APPROVAL_EXPIRED" as const,
        duplicate: false,
      }
    }

    const incident = await this.retrieveAgentIncident(
      approval.incident_id,
      {},
      sharedContext
    )
    const nextIncidentStatus =
      input.decision === "APPROVED" ? "EXECUTING" : "REJECTED"
    assertIncidentTransition(
      incident.status as IncidentStatus,
      nextIncidentStatus
    )

    const updatedApproval = await this.updateAgentApprovals(
      {
        decided_at: now,
        decision_by_id: input.actor_id,
        decision_by_type: "user",
        decision_reason: input.reason,
        id: approval.id,
        status: input.decision,
      },
      sharedContext
    )
    const recommendation = await this.updateAgentRecommendations(
      {
        id: approval.recommendation_id,
        status: input.decision,
      },
      sharedContext
    )
    await this.updateAgentIncidents(
      {
        id: incident.id,
        status: nextIncidentStatus,
      },
      sharedContext
    )

    await this.createAgentAuditEvents(
      {
        action: "approval-decided",
        actor_id: input.actor_id,
        actor_type: "user",
        correlation_id: incident.correlation_id,
        data: {
          decision: input.decision,
          reason: input.reason,
        },
        event_type: "approval.decided",
        incident_id: incident.id,
        recorded_at: now,
        resource_id: approval.id,
        resource_type: "agent_approval",
      },
      sharedContext
    )
    let actionRequest: Awaited<
      ReturnType<typeof this.retrieveAgentActionRequest>
    > | null = null

    if (
      input.decision === "APPROVED" &&
      recommendation.action_type === "INVENTORY_TRANSFER"
    ) {
      const proposal = recommendation.proposal as Record<string, unknown>
      const actionInput = InventoryTransferInput.parse({
        inventory_item_id: proposal.inventory_item_id,
        quantity: proposal.quantity,
        source_location_id: proposal.source_location_id,
        target_location_id: proposal.target_location_id,
      })
      actionRequest = await this.createAgentActionRequests(
        {
          action_type: recommendation.action_type,
          approval_id: approval.id,
          authorized_roles: { values: [approval.required_role] },
          available_at: now,
          correlation_id: incident.correlation_id,
          idempotency_key: `approval:${approval.id}:inventory-transfer:1`,
          incident_id: incident.id,
          input: actionInput,
          permission: "agent_inventory:transfer",
          policy_key: approval.policy_key,
          policy_version: approval.policy_version,
          recommendation_id: recommendation.id,
          requested_at: now,
          requested_by_id: input.actor_id,
          requested_by_type: "user",
          risk_level: recommendation.risk_level,
          status: "PENDING",
          tenant_id: incident.tenant_id,
          tool_name: "inventory.execute-transfer",
          tool_version: "1.0.0",
        },
        sharedContext
      )
    }

    await this.createAgentOutboxEvents(
      {
        aggregate_id: incident.id,
        aggregate_type: "agent_incident",
        available_at: now,
        event_type: "approval.decided",
        event_version: 1,
        idempotency_key: `approval:${approval.id}:${input.decision}`,
        payload: {
          action_request_id: actionRequest?.id,
          approval_id: approval.id,
          decision: input.decision,
          incident_id: incident.id,
          recommendation_id: approval.recommendation_id,
        },
        status: "PENDING",
      },
      sharedContext
    )

    if (actionRequest) {
      await this.createAgentOutboxEvents(
        {
          aggregate_id: incident.id,
          aggregate_type: "agent_incident",
          available_at: now,
          event_type: "agent.action.requested",
          event_version: 1,
          idempotency_key: `action:${actionRequest.id}:requested`,
          payload: {
            action_request_id: actionRequest.id,
            approval_id: approval.id,
            incident_id: incident.id,
            recommendation_id: recommendation.id,
          },
          status: "PENDING",
        },
        sharedContext
      )
    }

    return {
      action_request: actionRequest,
      approval: updatedApproval,
      duplicate: false,
    }
  }

  @InjectTransactionManager()
  private async transitionIncident(
    incidentId: string,
    from: IncidentStatus,
    to: IncidentStatus,
    @MedusaContext() sharedContext: Context
  ) {
    assertIncidentTransition(from, to)
    return this.updateAgentIncidents(
      { id: incidentId, status: to },
      sharedContext
    )
  }

  @InjectTransactionManager()
  private async findApprovalForIncident(
    incidentId: string | undefined,
    @MedusaContext() sharedContext: Context
  ) {
    if (!incidentId) {
      return null
    }
    const approvals = await this.listAgentApprovals(
      { incident_id: incidentId },
      { take: 1 },
      sharedContext
    )
    return approvals[0] ?? null
  }

  @InjectTransactionManager()
  private async findRecommendationForIncident(
    incidentId: string | undefined,
    @MedusaContext() sharedContext: Context
  ) {
    if (!incidentId) {
      return null
    }
    const recommendations = await this.listAgentRecommendations(
      { incident_id: incidentId },
      { take: 1 },
      sharedContext
    )
    return recommendations[0] ?? null
  }

  @InjectTransactionManager()
  private async findActionRequestForApproval(
    approvalId: string,
    @MedusaContext() sharedContext: Context
  ) {
    const actions = await this.listAgentActionRequests(
      { approval_id: approvalId },
      { take: 1 },
      sharedContext
    )
    return actions[0] ?? null
  }
}

function platformConflict(code: string, message: string) {
  return { code, message, outcome: "CONFLICT" as const }
}

function platformIncidentResult(
  incident: { id: string; status: string; title: string },
  duplicate: boolean
) {
  return {
    duplicate,
    incident: {
      incident_id: incident.id,
      status: incident.status as IncidentStatus,
      title: incident.title,
    },
    outcome: "SUCCEEDED" as const,
  }
}

function getAuthorizedRoles(value: Record<string, unknown>) {
  return Array.isArray(value.values)
    ? value.values.filter((role): role is string => typeof role === "string")
    : []
}

export default AgentOperationsModuleService
