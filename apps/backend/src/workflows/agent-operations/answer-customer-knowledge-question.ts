import type { ILockingModule, IOrderModuleService } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { ProcessCustomerKnowledgeQuestionInput } from "../../modules/agent-operations/types"
import { executeCatalogRead } from "../../modules/agent-operations/catalog-read-runtime"
import {
  extractCatalogSearchQuery,
  extractRecentCatalogSearchQuery,
  isPotentialProductRequest,
  shouldReadCatalogForCustomerMessage
} from "../../modules/agent-operations/customer-product-advisor"
import { detectKnowledgeQuestionLocale } from "../../modules/agent-operations/knowledge-answer"
import {
  extractCustomerOrderDisplayId,
  getVerifiedLinkedCustomerId,
  isAwaitingCustomerOrderReference,
  shouldReadCustomerFulfillment,
  shouldReadCustomerPayment
} from "../../modules/agent-operations/customer-order-lookup"
import { executeFulfillmentRead } from "../../modules/agent-operations/fulfillment-read-runtime"
import { executeOrderRead } from "../../modules/agent-operations/order-read-runtime"
import { executePaymentRead } from "../../modules/agent-operations/payment-read-runtime"
import {
  createCustomerSupportNativeToolDispatcher,
  getCustomerSupportNativeTools,
  resolveCustomerDraftCartPurchaseContext
} from "../../modules/agent-operations/customer-native-tool-dispatcher"
import {
  createModelAdapter,
  redactModelInput
} from "../../modules/agent-operations/model-gateway"
import { extractNativeCustomerSupportContext } from "../../modules/agent-operations/native-customer-support-context"
import { evaluateNativeToolLoop } from "../../modules/agent-operations/native-tool-loop-evaluation"
import { runNativeToolLoop } from "../../modules/agent-operations/native-tool-loop"
import {
  CUSTOMER_SUPPORT_ORCHESTRATOR_OUTPUT_SCHEMA,
  CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY,
  CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_VERSION,
  CUSTOMER_SUPPORT_ORCHESTRATOR_TIMEOUT_MS,
  CUSTOMER_SUPPORT_TRAVEL_TOOL_POLICY,
  CustomerSupportOrchestratorDecision,
  reconcileCustomerSupportDecision
} from "../../modules/agent-operations/customer-support-orchestrator"
import { shouldUseHistoricalCustomerProfile } from "../../modules/agent-operations/conversation-memory"
import { formatCustomerProfilePreferences } from "../../modules/agent-operations/customer-preferences"
import { CUSTOMER_MESSAGE_INTENTS } from "../../modules/agent-operations/customer-message-intent"
import { GuardrailsEngine } from "../../modules/agent-operations/guardrails"

const answerCustomerKnowledgeQuestionStep = createStep(
  "answer-customer-knowledge-question",
  async (input: ProcessCustomerKnowledgeQuestionInput, { container }) => {
    const startedAt = Date.now()
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const service = container.resolve<AgentOperationsModuleService>(AGENT_OPERATIONS_MODULE)
    const inbound = await service.retrieveAgentMessage(input.inbound_message_id)

    const inputGuardrail = GuardrailsEngine.evaluateInputSafeguard(inbound.body)

    let catalogSnapshot
    let customerOrderLookup: ProcessCustomerKnowledgeQuestionInput["customer_order_lookup"]
    let customerOrderLookupLocale: "en" | "vi" | undefined
    let knowledgeSnapshot: ProcessCustomerKnowledgeQuestionInput["knowledge_snapshot"]
    let nativeRoute: ProcessCustomerKnowledgeQuestionInput["native_route"]
    let nativeToolTrace: ProcessCustomerKnowledgeQuestionInput["native_tool_trace"]
    let orchestratorDecision: ProcessCustomerKnowledgeQuestionInput["orchestrator_decision"]
    let proposalResult: ProcessCustomerKnowledgeQuestionInput["proposal_result"]
    let shippingEstimate: ProcessCustomerKnowledgeQuestionInput["shipping_estimate"]
    let travelContext: ProcessCustomerKnowledgeQuestionInput["travel_context"]
    let useNativeOrchestration = false
    const existingResponse = (
      await service.listAgentMessages(
        { idempotency_key: `customer-answer:${inbound.id}` },
        { take: 1 }
      )
    )[0]
    if (!existingResponse) {
      const locale = detectKnowledgeQuestionLocale(inbound.body)
      try {
        const [conversation, assistantSettings] = await Promise.all([
          service.retrieveAgentConversation(inbound.conversation_id),
          service.getAssistantSettings()
        ])
        if (
          assistantSettings.native_tool_loop_mode !== "DISABLED" &&
          inputGuardrail.allowed
        ) {
          const metadata = (conversation.metadata ?? {}) as Record<string, unknown>
          const customerId = getVerifiedLinkedCustomerId(metadata)
          const availableNativeTools = getCustomerSupportNativeTools(customerId)
          const availableNativeToolNames = new Set(
            availableNativeTools.map((tool) => tool.name)
          )
          try {
            const [
              credentials,
              promptConfig,
              memories,
              recentConversation,
              customerPreferences,
              purchaseContext
            ] = await Promise.all([
              service.getActiveAiProviderCredentials("generation", conversation.tenant_id),
              service.getPromptConfiguration(CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY),
              service.listAgentConversationMemories(
                { conversation_id: conversation.id },
                { take: 1 }
              ),
              service.listAgentMessages(
                { conversation_id: conversation.id },
                { order: { occurred_at: "DESC" }, take: 10 }
              ),
              service.listAgentCustomerPreferences(
                {
                  customer_id: inbound.sender_id,
                  tenant_id: conversation.tenant_id
                },
                { order: { last_confirmed_at: "DESC" }, take: 12 }
              ),
              resolveCustomerDraftCartPurchaseContext(container, locale)
            ])
            const historicalProfilePreferencesAllowed =
              shouldUseHistoricalCustomerProfile(inbound.body)
            const activeConversationIntent = recentConversation
              .filter((message) => message.id !== inbound.id)
              .find((message) => {
                const intent = (message.structured_content as Record<string, unknown> | null)
                  ?.intent
                return (
                  message.direction === "OUTBOUND" &&
                  typeof intent === "string" &&
                  CUSTOMER_MESSAGE_INTENTS.includes(
                    intent as (typeof CUSTOMER_MESSAGE_INTENTS)[number]
                  )
                )
              })?.structured_content as Record<string, unknown> | undefined
            const safeOrchestratorInput = {
              active_conversation_intent:
                (activeConversationIntent?.intent as string | undefined) ?? null,
              assistant_identity: {
                bot_role: assistantSettings.bot_role,
                brand_name: assistantSettings.brand_name
              },
              conversation_id: conversation.id,
              conversation_memory: memories[0]
                ? {
                    customer_facts: memories[0].customer_facts,
                    open_questions: memories[0].open_questions,
                    resolved_topics: memories[0].resolved_topics,
                    summary: memories[0].summary?.slice(-1_600) ?? ""
                  }
                : null,
              current_message: inbound.body.slice(0, 1_000),
              customer_confirmation_message_id: inbound.id,
              locale,
              historical_profile_preferences:
                historicalProfilePreferencesAllowed
                  ? formatCustomerProfilePreferences(customerPreferences).slice(0, 6)
                  : [],
              historical_profile_preferences_allowed:
                historicalProfilePreferencesAllowed,
              mode: assistantSettings.native_tool_loop_mode,
              purchase_context: purchaseContext,
              recent_conversation: recentConversation
                .slice()
                .reverse()
                .filter((message) => message.id !== inbound.id)
                .slice(-8)
                .map((message) => ({
                  body: message.body.slice(0, 500),
                  direction: message.direction
                }))
            }
            let orchestratorCompleted = false
            for (const credential of credentials) {
              const adapter = createModelAdapter({
                apiKey: credential.api_key,
                model: credential.model,
                provider: credential.provider
              })
              const attemptKey =
                `customer-orchestrator:${inbound.id}:provider:${adapter.provider}`
              const startedAt = new Date()
              const existingRun = (
                await service.listAgentModelRuns(
                  { idempotency_key: attemptKey },
                  { take: 1 }
                )
              )[0]
              const modelRun = existingRun
                ? await service.updateAgentModelRuns({
                    id: existingRun.id,
                    input: redactModelInput(safeOrchestratorInput) as Record<string, unknown>,
                    model: adapter.model,
                    prompt_version: promptConfig.version,
                    provider: adapter.provider,
                    started_at: startedAt,
                    status: "RUNNING"
                  })
                : await service.createAgentModelRuns({
                    agent_id: "customer-support-orchestrator",
                    agent_version: CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_VERSION,
                    idempotency_key: attemptKey,
                    input: redactModelInput(safeOrchestratorInput) as Record<string, unknown>,
                    model: adapter.model,
                    prompt_key: CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY,
                    prompt_version: promptConfig.version,
                    provider: adapter.provider,
                    redacted: true,
                    started_at: startedAt,
                    status: "RUNNING"
                  })
              try {
                const loop = await runNativeToolLoop({
                  adapter,
                  execute_tool: createCustomerSupportNativeToolDispatcher({
                    container,
                    conversation_id: conversation.id,
                    customer_id: customerId,
                    customer_message_context: [
                      inbound.body,
                      ...recentConversation
                        .filter((message) => message.direction === "INBOUND")
                        .map((message) => message.body)
                    ],
                    inbound_message_id: inbound.id,
                    locale,
                    service,
                    tenant_id: conversation.tenant_id
                  }),
                  invocation: {
                    agent_id: "customer-support-orchestrator",
                    input: safeOrchestratorInput,
                    max_tokens: promptConfig.max_tokens,
                    output_schema: CUSTOMER_SUPPORT_ORCHESTRATOR_OUTPUT_SCHEMA,
                    prompt_key: CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY,
                    prompt_version: promptConfig.version,
                    system_prompt: promptConfig.system_prompt.includes("Travel advisor tool policy:")
                      ? promptConfig.system_prompt
                      : `${promptConfig.system_prompt}\n\n${CUSTOMER_SUPPORT_TRAVEL_TOOL_POLICY}`,
                    tools: availableNativeTools,
                    timeout_ms: CUSTOMER_SUPPORT_ORCHESTRATOR_TIMEOUT_MS
                  }
                })
                const evaluation = evaluateNativeToolLoop({
                  allowed_tool_names: availableNativeToolNames,
                  termination: loop.termination,
                  trace: loop.trace
                })
                const nativeContext = extractNativeCustomerSupportContext(loop.tool_results)
                const toolContextSafe = evaluation.assertions
                  .filter((assertion) => assertion.id !== "completion")
                  .every((assertion) => assertion.passed)
                if (
                  assistantSettings.native_tool_loop_mode === "ACTIVE" &&
                  toolContextSafe
                ) {
                  catalogSnapshot ??= nativeContext.catalog_snapshot
                  customerOrderLookup ??= nativeContext.customer_order_lookup
                  knowledgeSnapshot ??= nativeContext.knowledge_snapshot
                  proposalResult ??= nativeContext.proposal_result
                  shippingEstimate ??= nativeContext.shipping_estimate
                  travelContext ??= nativeContext.travel_context
                  nativeToolTrace ??= loop.trace
                }
                const parsedDecision = CustomerSupportOrchestratorDecision.safeParse(
                  loop.output
                )
                const decision = parsedDecision.success
                  ? reconcileCustomerSupportDecision(parsedDecision.data, {
                      catalog_ready:
                        nativeContext.catalog_snapshot?.status === "READY",
                      proposal_ready: Boolean(nativeContext.proposal_result)
                    })
                  : null
                orchestratorCompleted = Boolean(decision && evaluation.safe_to_use)
                await service.updateAgentModelRuns({
                  completed_at: new Date(),
                  id: modelRun.id,
                  latency_ms: Date.now() - startedAt.getTime(),
                  output: {
                    decision,
                    evaluation,
                    termination: loop.termination,
                    tool_trace: loop.trace
                  },
                  status: decision && evaluation.safe_to_use ? "SUCCEEDED" : "FAILED"
                })
                if (
                  assistantSettings.native_tool_loop_mode === "ACTIVE" &&
                  evaluation.safe_to_use &&
                  decision
                ) {
                  catalogSnapshot = nativeContext.catalog_snapshot
                  customerOrderLookup = nativeContext.customer_order_lookup
                  knowledgeSnapshot = nativeContext.knowledge_snapshot
                  nativeRoute = decision.intent
                  nativeToolTrace = loop.trace
                  orchestratorDecision = decision
                  proposalResult = nativeContext.proposal_result
                  shippingEstimate = nativeContext.shipping_estimate
                  travelContext = nativeContext.travel_context
                  useNativeOrchestration = true
                }
                await service.createAgentAuditEvents({
                  action:
                    assistantSettings.native_tool_loop_mode === "ACTIVE"
                      ? "customer-native-tool-loop-active-completed"
                      : "customer-native-tool-loop-shadow-completed",
                  actor_id: "customer-support-agent",
                  actor_type: "agent",
                  correlation_id: `customer-native-shadow:${conversation.id}:${inbound.id}`,
                  data: {
                    mode: assistantSettings.native_tool_loop_mode,
                    decision,
                    used_as_response_context:
                      assistantSettings.native_tool_loop_mode === "ACTIVE" &&
                      evaluation.safe_to_use &&
                      Boolean(decision),
                    evaluation,
                    iterations: loop.iterations,
                    termination: loop.termination,
                    trace: loop.trace
                  },
                  event_type:
                    assistantSettings.native_tool_loop_mode === "ACTIVE"
                      ? "agent.customer-support.native-tool-loop-active-completed"
                      : "agent.customer-support.native-tool-loop-shadow-completed",
                  recorded_at: new Date(),
                  resource_id: inbound.id,
                  resource_type: "agent_message"
                })
                if (orchestratorCompleted) break
              } catch (error) {
                await service.updateAgentModelRuns({
                  completed_at: new Date(),
                  error:
                    error instanceof Error
                      ? error.message.slice(0, 1_000)
                      : "Customer support orchestrator failed",
                  id: modelRun.id,
                  latency_ms: Date.now() - startedAt.getTime(),
                  status: "FAILED"
                })
              }
            }
            if (!orchestratorCompleted) {
              throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                "No configured model provider completed a safe customer-support orchestration."
              )
            }
          } catch (error) {
            await service.createAgentAuditEvents({
              action:
                assistantSettings.native_tool_loop_mode === "ACTIVE"
                  ? "customer-native-tool-loop-active-failed"
                  : "customer-native-tool-loop-shadow-failed",
              actor_id: "customer-support-agent",
              actor_type: "agent",
              correlation_id: `customer-native-shadow:${conversation.id}:${inbound.id}`,
              data: {
                error:
                  error instanceof Error ? error.message.slice(0, 300) : "Native tool loop failed"
              },
              event_type:
                assistantSettings.native_tool_loop_mode === "ACTIVE"
                  ? "agent.customer-support.native-tool-loop-active-failed"
                  : "agent.customer-support.native-tool-loop-shadow-failed",
              recorded_at: new Date(),
              resource_id: inbound.id,
              resource_type: "agent_message"
            })
          }
        }
        if (!useNativeOrchestration) {
          const [recentInbound, recentMessages] = await Promise.all([
            service.listAgentMessages(
              {
                conversation_id: conversation.id,
                direction: "INBOUND"
              },
              { order: { occurred_at: "DESC" }, take: 6 }
            ),
            service.listAgentMessages(
              { conversation_id: conversation.id },
              { order: { occurred_at: "DESC" }, take: 8 }
            )
          ])
          const priorInbound = recentInbound.filter((message) => message.id !== inbound.id)
          const awaitingOrderReference = isAwaitingCustomerOrderReference(
            recentMessages.filter((message) => message.id !== inbound.id)
          )
          const pendingOrderPrompt = recentMessages
            .filter((message) => message.id !== inbound.id && message.direction === "OUTBOUND")
            .find((message) => {
              const structured = message.structured_content as Record<string, unknown> | null
              return structured?.pending_customer_input === "ORDER_REFERENCE"
            })
          const pendingOrderPromptLocale = pendingOrderPrompt?.structured_content
            ? (pendingOrderPrompt.structured_content as Record<string, unknown>).locale
            : undefined
          customerOrderLookupLocale =
            pendingOrderPromptLocale === "en" || pendingOrderPromptLocale === "vi"
              ? pendingOrderPromptLocale
              : undefined
          const explicitDisplayId = extractCustomerOrderDisplayId(inbound.body)
          const displayId =
            explicitDisplayId ??
            (awaitingOrderReference ? extractCustomerOrderDisplayId(inbound.body, true) : null)
          if (displayId && (awaitingOrderReference || explicitDisplayId)) {
            const metadata = (conversation.metadata ?? {}) as Record<string, unknown>
            const customerId = getVerifiedLinkedCustomerId(metadata)
            if (!customerId) {
              customerOrderLookup = {
                display_id: displayId,
                status: "ACCOUNT_NOT_LINKED"
              }
            } else {
              const query = container.resolve(ContainerRegistrationKeys.QUERY)
              const { data: ordersByDisplayId } = await query.graph({
                entity: "order",
                fields: ["id"],
                filters: {
                  customer_id: customerId,
                  display_id: String(displayId)
                },
                pagination: { skip: 0, take: 2 }
              })
              if (ordersByDisplayId.length !== 1) {
                customerOrderLookup = {
                  display_id: displayId,
                  status: "NOT_FOUND"
                }
              } else {
                const read = await executeOrderRead(
                  container,
                  { order_id: ordersByDisplayId[0].id },
                  "customer-knowledge-agent"
                )
                await service.recordCustomerReadToolCall({
                  conversation_id: conversation.id,
                  inbound_message_id: inbound.id,
                  input: read.input,
                  output: {
                    display_id: read.output.display_id,
                    fulfillment_status: read.output.fulfillment_status,
                    order_status: read.output.order_status,
                    payment_status: read.output.payment_status,
                    version: read.output.version
                  },
                  tool_name: read.definition.name,
                  tool_version: read.definition.version
                })
                const [fulfillment, payment] = await Promise.all([
                  shouldReadCustomerFulfillment(inbound.body)
                    ? executeFulfillmentRead(
                        container,
                        { order_id: read.output.order_id },
                        "customer-knowledge-agent"
                      )
                    : Promise.resolve(null),
                  shouldReadCustomerPayment(inbound.body)
                    ? executePaymentRead(
                        container,
                        { order_id: read.output.order_id },
                        "customer-knowledge-agent"
                      )
                    : Promise.resolve(null)
                ])
                if (fulfillment) {
                  await service.recordCustomerReadToolCall({
                    conversation_id: conversation.id,
                    inbound_message_id: inbound.id,
                    input: fulfillment.input,
                    output: fulfillment.output,
                    tool_name: fulfillment.definition.name,
                    tool_version: fulfillment.definition.version
                  })
                }
                if (payment) {
                  await service.recordCustomerReadToolCall({
                    conversation_id: conversation.id,
                    inbound_message_id: inbound.id,
                    input: payment.input,
                    output: payment.output,
                    tool_name: payment.definition.name,
                    tool_version: payment.definition.version
                  })
                }
                customerOrderLookup = {
                  display_id: displayId,
                  fulfillment: fulfillment?.output,
                  order: read.output,
                  payment: payment?.output,
                  status: "FOUND"
                }
              }
            }
          }
          const shouldReadCatalog = shouldReadCatalogForCustomerMessage(
            inbound.body,
            priorInbound.map((message) => message.body)
          )
          if (shouldReadCatalog) {
            const catalogQuery =
              extractCatalogSearchQuery(inbound.body) ??
              extractRecentCatalogSearchQuery(
                priorInbound.map((message) => ({
                  body: message.body,
                  direction: message.direction as "INBOUND" | "OUTBOUND"
                }))
              )
            let catalogRead = await executeCatalogRead(
              container,
              {
                limit: 8,
                locale,
                query: catalogQuery
              },
              { tenant_id: conversation.tenant_id }
            )
            if (!catalogRead.output.products.length) {
              catalogRead = await executeCatalogRead(
                container,
                {
                  limit: 8,
                  locale,
                  query: undefined
                },
                { tenant_id: conversation.tenant_id }
              )
            }
            await service.recordCustomerReadToolCall({
              conversation_id: conversation.id,
              inbound_message_id: inbound.id,
              input: catalogRead.input,
              output: {
                cache_status: catalogRead.cache_status,
                product_ids: catalogRead.output.products.map((product) => product.id),
                total_count: catalogRead.output.total_count
              },
              tool_name: catalogRead.definition.name,
              tool_version: catalogRead.definition.version
            })
            catalogSnapshot = catalogRead.output
          }
        }
      } catch {
        if (isPotentialProductRequest(inbound.body)) {
          catalogSnapshot = {
            products: [] as [],
            query: extractCatalogSearchQuery(inbound.body) ?? null,
            status: "UNAVAILABLE" as const,
            total_count: 0 as const
          }
        }
      }
    }
    const result = await locking.execute(
      `customer-knowledge-answer:${inbound.conversation_id}`,
      () =>
        service.processCustomerKnowledgeQuestion({
          catalog_snapshot: catalogSnapshot,
          customer_order_lookup: customerOrderLookup,
          customer_order_lookup_locale: customerOrderLookupLocale,
          inbound_message_id: inbound.id,
          knowledge_snapshot: knowledgeSnapshot,
          native_route: nativeRoute,
          native_tool_trace: nativeToolTrace,
          orchestrator_decision: orchestratorDecision,
          proposal_result: proposalResult,
          shipping_estimate: shippingEstimate,
          travel_context: travelContext,
        })
    )
    const imageAttachments = ((inbound.structured_content ?? {}) as Record<string, unknown>)
      .image_attachments
    const imageUrls = Array.isArray(imageAttachments)
      ? imageAttachments.flatMap((attachment) => {
          if (!attachment || typeof attachment !== "object") return []
          const url = (attachment as Record<string, unknown>).url
          return typeof url === "string" ? [url] : []
        })
      : []
    const visionAnalysis = imageUrls.length
      ? await service.analyzeCustomerSupportImages({
          caption: inbound.body,
          image_urls: imageUrls,
          inbound_message_id: inbound.id,
          tenant_id: (await service.retrieveAgentConversation(inbound.conversation_id)).tenant_id
        })
      : null
    if (visionAnalysis && visionAnalysis.defect_type !== "NONE") {
      const escalation = await service.createCustomerKnowledgeEscalation({
        conversation_id: inbound.conversation_id,
        inbound_message_id: inbound.id,
        locale: detectKnowledgeQuestionLocale(inbound.body),
        question: inbound.body,
        reason: "VISION_REVIEW",
        vision_analysis: visionAnalysis
      })
      result.support_task_id = escalation.task?.id ?? result.support_task_id
    }

    return new StepResponse({
      ...result,
      response_preparation_ms: Date.now() - startedAt
    })
  }
)

export const answerCustomerKnowledgeQuestionWorkflow = createWorkflow(
  "answer-customer-knowledge-question",
  function (input: ProcessCustomerKnowledgeQuestionInput) {
    return new WorkflowResponse(answerCustomerKnowledgeQuestionStep(input))
  }
)
