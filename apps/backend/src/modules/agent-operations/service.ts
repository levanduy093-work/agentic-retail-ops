import { Context } from "@medusajs/framework/types"
import {
  InjectTransactionManager,
  InjectManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { calculateActionRetry, isAgentActionClaimable } from "./action-policy"
import {
  buildApprovalDecisionResultMessage,
  buildApprovalRequestedMessage,
  isApprovalDecisionCommandTarget,
} from "./communication"
import { analyzeInventoryLow } from "./inventory-low-analyzer"
import { analyzeOrderException } from "./order-exception-analyzer"
import AgentActionRequest from "./models/agent-action-request"
import AgentApproval from "./models/agent-approval"
import AgentAuditEvent from "./models/agent-audit-event"
import AgentChannelConnection from "./models/agent-channel-connection"
import AgentConversation from "./models/agent-conversation"
import AgentDelivery from "./models/agent-delivery"
import AgentEvaluationRun from "./models/agent-evaluation-run"
import AgentEvaluationCase from "./models/agent-evaluation-scenario"
import AgentEvent from "./models/agent-event"
import AgentIncident from "./models/agent-incident"
import AgentKnowledgeDocument from "./models/agent-knowledge-document"
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
import { conditionMatches, evaluatePolicies } from "./policy-engine"
import { assertIncidentTransition, canTransitionIncident } from "./state-machine"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool, prepareAgentCommand } from "./tool-executor"
import { InventoryTransferInput } from "./tools/inventory-tools"
import {
  ApprovalDecisionInput,
  ApproveKnowledgeDocumentInput,
  ClaimAgentActionInput,
  ClaimAgentOutboxEventInput,
  CompleteAgentOutboxEventInput,
  CreateAgentTaskInput,
  CreateApprovalRequestedNotificationInput,
  CreateKnowledgeDocumentInput,
  EvaluationAssertion,
  EscalateAgentTaskInput,
  FailAgentActionInput,
  FailAgentOutboxEventInput,
  IncidentStatus,
  InventoryLowEventInput,
  OrderExceptionEventInput,
  PolicyCondition,
  ProcessAgentConversationMessageInput,
  RequestAgentActionInput,
  TransitionAgentTaskInput,
} from "./types"
import { evaluateAssertions } from "./evaluation"
import { checksumKnowledgeContent } from "./knowledge"
import { assertAgentTaskTransition } from "./task-state-machine"
import {
  AuditSearchInput,
  AuditSearchOutput,
  buildTraceReplayOutput,
  formatAuditSearchResult,
  KnowledgeSearchInput,
  KnowledgeSearchOutput,
  searchKnowledgeDocuments,
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
import { OrderReadOutput } from "./tools/order-tools"

class AgentOperationsModuleService extends MedusaService({
  AgentActionRequest,
  AgentApproval,
  AgentAuditEvent,
  AgentChannelConnection,
  AgentConversation,
  AgentDelivery,
  AgentEvaluationRun,
  AgentEvaluationCase,
  AgentEvent,
  AgentIncident,
  AgentKnowledgeDocument,
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

    return { document, duplicate: false }
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
        actor_type: "user",
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

    return searchKnowledgeDocuments(parsed, documents)
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
        return {
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
