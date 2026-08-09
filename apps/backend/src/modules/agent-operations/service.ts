import { Context } from "@medusajs/framework/types"
import {
  InjectTransactionManager,
  InjectManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import {
  calculateActionRetry,
  isAgentActionClaimable,
} from "./action-policy"
import {
  buildApprovalDecisionResultMessage,
  buildApprovalRequestedMessage,
  isApprovalDecisionCommandTarget,
} from "./communication"
import { analyzeInventoryLow } from "./inventory-low-analyzer"
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
import { evaluatePolicies } from "./policy-engine"
import { assertIncidentTransition } from "./state-machine"
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
  FailAgentActionInput,
  FailAgentOutboxEventInput,
  IncidentStatus,
  InventoryLowEventInput,
  PolicyCondition,
  ProcessAgentConversationMessageInput,
  TransitionAgentTaskInput,
} from "./types"
import { evaluateAssertions } from "./evaluation"
import { checksumKnowledgeContent } from "./knowledge"
import { assertAgentTaskTransition } from "./task-state-machine"

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
        status: requiresApproval
          ? "PENDING_APPROVAL"
          : "PROPOSED",
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
        const conflict =
          "conflict" in decision ? decision.conflict : undefined

        accepted = !conflict
        commandDuplicate = decision.duplicate
        actionRequestId =
          "action_request" in decision
            ? decision.action_request?.id ?? null
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

    const approval = await this.retrieveAgentApproval(
      claimedAction.approval_id,
      {},
      sharedContext
    )
    const incident = await this.retrieveAgentIncident(
      claimedAction.incident_id,
      {},
      sharedContext
    )
    const recommendation = await this.retrieveAgentRecommendation(
      claimedAction.recommendation_id,
      {},
      sharedContext
    )

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

    if (action.status !== "PROCESSING" || action.locked_by !== input.worker_id) {
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
      const incident = await this.retrieveAgentIncident(
        action.incident_id,
        {},
        sharedContext
      )

      if (incident.status === "EXECUTING") {
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

      await this.updateAgentRecommendations(
        { id: action.recommendation_id, status: "FAILED" },
        sharedContext
      )
      await this.createAgentAuditEvents(
        {
          action: "inventory-transfer-dead-lettered",
          actor_id: input.worker_id,
          actor_type: "worker",
          correlation_id: incident.correlation_id,
          data: {
            action_request_id: action.id,
            attempt_count: updatedAction.attempt_count,
            error: updatedAction.last_error,
          },
          event_type: "agent.action.dead-lettered",
          incident_id: incident.id,
          recorded_at: failedAt,
          resource_id: action.id,
          resource_type: "agent_action_request",
        },
        sharedContext
      )
      await this.createAgentOutboxEvents(
        {
          aggregate_id: incident.id,
          aggregate_type: "agent_incident",
          available_at: failedAt,
          event_type: "agent.action.dead-lettered",
          event_version: 1,
          idempotency_key: `action:${action.id}:dead`,
          payload: {
            action_request_id: action.id,
            attempt_count: updatedAction.attempt_count,
            error: updatedAction.last_error,
            incident_id: incident.id,
          },
          status: "PENDING",
        },
        sharedContext
      )
    }

    return updatedAction
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

    if (action.status !== "PROCESSING" || action.locked_by !== input.worker_id) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Action ${action.id} is not leased by ${input.worker_id}.`
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
          available_at: now,
          idempotency_key: `approval:${approval.id}:inventory-transfer:1`,
          incident_id: incident.id,
          input: actionInput,
          recommendation_id: recommendation.id,
          requested_at: now,
          requested_by_id: input.actor_id,
          requested_by_type: "user",
          risk_level: recommendation.risk_level,
          status: "PENDING",
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

export default AgentOperationsModuleService
