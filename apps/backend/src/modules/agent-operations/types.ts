export const AGENT_EVENT_STATUSES = ["RECEIVED", "PROCESSED", "FAILED"] as const

export const INCIDENT_STATUSES = [
  "RECEIVED",
  "INVESTIGATING",
  "OPTIONS_READY",
  "AWAITING_APPROVAL",
  "EXECUTING",
  "MONITORING",
  "RESOLVED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
  "ESCALATED",
] as const

export const AGENT_RUN_STATUSES = INCIDENT_STATUSES

export const RECOMMENDATION_STATUSES = [
  "PROPOSED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "EXECUTED",
  "FAILED",
] as const

export const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const

export const RISK_LEVELS = [
  "READ_ONLY",
  "LOW",
  "MEDIUM",
  "HIGH",
  "PROHIBITED",
] as const

export const OUTBOX_STATUSES = [
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED",
  "DEAD",
] as const

export const ACTION_REQUEST_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "CONFLICT",
  "FAILED",
  "DEAD",
  "CANCELLED",
] as const

export const TOOL_CALL_KINDS = ["READ", "COMMAND"] as const

export const TOOL_CALL_STATUSES = [
  "RUNNING",
  "SUCCEEDED",
  "CONFLICT",
  "FAILED",
] as const

export const CONVERSATION_CHANNELS = [
  "IN_APP",
  "WEB_PUSH",
  "TELEGRAM",
  "ZALO",
  "SLACK",
  "TEAMS",
] as const

export const CONVERSATION_STATUSES = ["OPEN", "CLOSED"] as const

export const MESSAGE_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const

export const MESSAGE_TYPES = [
  "NOTIFICATION",
  "COMMAND",
  "COMMAND_RESULT",
  "TEXT",
] as const

export const MESSAGE_STATUSES = [
  "RECEIVED",
  "AVAILABLE",
  "PROCESSED",
  "REJECTED",
] as const

export const AGENT_TASK_STATUSES = [
  "TODO",
  "CLAIMED",
  "IN_PROGRESS",
  "WAITING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "DEAD",
] as const

export const LIFECYCLE_STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const

export const KNOWLEDGE_STATUSES = ["DRAFT", "APPROVED", "RETIRED"] as const

export const MODEL_RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "REJECTED",
] as const

export const EVALUATION_RUN_STATUSES = [
  "RUNNING",
  "PASSED",
  "FAILED",
  "ERROR",
] as const

export const CHANNEL_CONNECTION_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "DISABLED",
] as const

export const DELIVERY_STATUSES = [
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED",
  "DEAD",
] as const

export type AgentEventStatus = (typeof AGENT_EVENT_STATUSES)[number]
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number]
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number]
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]
export type RiskLevel = (typeof RISK_LEVELS)[number]
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number]
export type AgentActionRequestStatus = (typeof ACTION_REQUEST_STATUSES)[number]
export type ToolCallKind = (typeof TOOL_CALL_KINDS)[number]
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number]
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number]
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number]
export type MessageType = (typeof MESSAGE_TYPES)[number]
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number]
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number]
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number]
export type ModelRunStatus = (typeof MODEL_RUN_STATUSES)[number]
export type EvaluationRunStatus = (typeof EVALUATION_RUN_STATUSES)[number]
export type ChannelConnectionStatus =
  (typeof CHANNEL_CONNECTION_STATUSES)[number]
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export type PolicyCondition = {
  field: string
  operator: "eq" | "gte" | "lte" | "in"
  value: unknown
}

export type EvaluationAssertion = {
  field: string
  operator: "eq" | "in" | "exists" | "not_exists"
  value?: unknown
}

export type CreateAgentTaskInput = {
  created_by_id: string
  created_by_type: "agent" | "system" | "user"
  description?: string
  due_at?: string
  idempotency_key: string
  incident_id?: string
  input?: Record<string, unknown>
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  task_type: string
  tenant_id?: string
  title: string
}

export type TransitionAgentTaskInput = {
  actor_id: string
  assigned_to_id?: string
  assigned_to_type?: "agent" | "team" | "user"
  expected_status: AgentTaskStatus
  failure?: string
  result?: Record<string, unknown>
  status: AgentTaskStatus
  task_id: string
}

export type ReleaseAgentTaskInput = {
  actor_id: string
  task_id: string
}

export type EscalateAgentTaskInput = {
  actor_id: string
  assigned_to_id: string
  assigned_to_type: "team" | "user"
  expected_status: AgentTaskStatus
  priority: "HIGH" | "CRITICAL"
  reason: string
  task_id: string
}

export type CreateKnowledgeDocumentInput = {
  citation_locator: string
  content: string
  document_key: string
  effective_at: string
  expires_at?: string
  locale?: string
  owner_id: string
  scope?: string
  tenant_id?: string
  title: string
  version: string
}

export type ApproveKnowledgeDocumentInput = {
  actor_id: string
  document_id: string
}

export type RetireKnowledgeDocumentInput = {
  actor_id: string
  document_id: string
  reason: string
}

export type CreateKnowledgeSourceInput = {
  locale: "en" | "vi"
  name: string
  owner_id: string
  scope: string
  source_type: "GOOGLE_DOC" | "GOOGLE_DRIVE" | "GOOGLE_SHEET" | "HTTPS_TEXT"
  source_url: string
  tenant_id?: string
}

export type SyncKnowledgeSourceInput = {
  actor_id: string
  source_id: string
}

export type ConfigureGoogleKnowledgeConnectorInput = {
  account_email: string
  actor_id: string
  refresh_token: string
  scopes: string[]
  tenant_id?: string
}

export type DisconnectGoogleKnowledgeConnectorInput = {
  actor_id: string
  tenant_id?: string
}

export type AiProvider = "GEMINI" | "OPENAI"

export type ConfigureAiProviderInput = {
  actor_id: string
  encrypted_api_key?: {
    encrypted_secret: string
    encryption_iv: string
    encryption_tag: string
    key_version: string
  }
  embedding_dimensions?: number | null
  embedding_enabled: boolean
  embedding_model: string
  generation_enabled: boolean
  generation_model: string
  provider: AiProvider
  secret_hint?: string
  tenant_id?: string
}

export type DisconnectAiProviderInput = {
  actor_id: string
  provider: AiProvider
  tenant_id?: string
}

export type ConfigureCustomerSupportPromptInput = {
  actor_id: string
  max_tokens: number
  system_prompt: string
}

export type InventoryLocationSnapshot = {
  available_quantity: number
  location_id: string
}

export type InventoryLowPayload = {
  alternative_locations: InventoryLocationSnapshot[]
  available_quantity: number
  inventory_item_id: string
  location_id: string
  required_quantity: number
}

export type InventoryLowEventInput = {
  causation_id?: string
  correlation_id: string
  event_id: string
  event_type: "inventory.low"
  event_version: number
  occurred_at: string
  payload: InventoryLowPayload
  source: string
  subject_id: string
  subject_type: "inventory_item"
  tenant_id: string
}

export type OrderExceptionType =
  | "FULFILLMENT_OVERDUE"
  | "MANUAL_REVIEW"
  | "PAYMENT_STUCK"

export type OrderExceptionPayload = {
  details?: Record<string, unknown>
  detected_at: string
  exception_type: OrderExceptionType
  order_id: string
  sla_due_at?: string
}

export type OrderExceptionEventInput = {
  causation_id?: string
  correlation_id: string
  event_id: string
  event_type: "order.exception"
  event_version: number
  occurred_at: string
  payload: OrderExceptionPayload
  source: string
  subject_id: string
  subject_type: "order"
  tenant_id: string
}

export type SupportRequestPayload = {
  customer_id: string
  locale: "en" | "vi"
  order_id: string
  question: string
  request_type: "ORDER_STATUS"
  requested_at: string
}

export type SupportRequestEventInput = {
  causation_id?: string
  correlation_id: string
  event_id: string
  event_type: "support.requested"
  event_version: number
  occurred_at: string
  payload: SupportRequestPayload
  source: string
  subject_id: string
  subject_type: "order"
  tenant_id: string
}

export type ApprovalDecisionInput = {
  actor_id: string
  approval_id: string
  decision: "APPROVED" | "REJECTED"
  reason: string
}

export type ApprovalDecisionConversationCommand = {
  approval_id: string
  decision: "APPROVED" | "REJECTED"
  name: "APPROVAL_DECISION"
  reason: string
}

export type CreateApprovalRequestedNotificationInput = {
  approval_id: string
  incident_id: string
  outbox_event_id: string
  recommendation_id: string
}

export type ProcessAgentConversationMessageInput = {
  actor_id: string
  body: string
  client_message_id: string
  command: ApprovalDecisionConversationCommand
  conversation_id: string
}

export type ClaimAgentOutboxEventInput = {
  claimed_at: string
  event_id: string
  lease_duration_ms: number
  worker_id: string
}

export type CompleteAgentOutboxEventInput = {
  completed_at: string
  event_id: string
  worker_id: string
}

export type FailAgentOutboxEventInput = {
  error: string
  event_id: string
  failed_at: string
  max_attempts: number
  max_retry_delay_ms: number
  retry_base_delay_ms: number
  worker_id: string
}

export type DispatchAgentOutboxEventInput = {
  event_id: string
  lease_duration_ms?: number
  max_attempts?: number
  max_retry_delay_ms?: number
  retry_base_delay_ms?: number
  worker_id: string
}

export type ClaimAgentDeliveryInput = {
  claimed_at: string
  delivery_id: string
  lease_duration_ms: number
  worker_id: string
}

export type CompleteAgentDeliveryInput = {
  completed_at: string
  delivery_id: string
  external_message_id: string
  worker_id: string
}

export type FailAgentDeliveryInput = {
  delivery_id: string
  error: string
  failed_at: string
  max_attempts: number
  max_retry_delay_ms: number
  retry_base_delay_ms: number
  worker_id: string
}

export type DispatchAgentDeliveryInput = {
  delivery_id: string
  lease_duration_ms?: number
  max_attempts?: number
  max_retry_delay_ms?: number
  retry_base_delay_ms?: number
  worker_id: string
}

export type ClaimAgentActionInput = {
  action_request_id: string
  claimed_at: string
  lease_duration_ms: number
  worker_id: string
}

export type FailAgentActionInput = {
  action_request_id: string
  error: string
  failed_at: string
  max_attempts: number
  max_retry_delay_ms: number
  retry_base_delay_ms: number
  worker_id: string
}

export type ExecuteAgentActionInput = {
  action_request_id: string
  actor_id: string
  actor_type: "user" | "worker"
  lease_duration_ms?: number
  max_attempts?: number
  max_retry_delay_ms?: number
  retry_base_delay_ms?: number
  worker_id: string
}

export type RequestAgentActionInput = {
  approval_id?: string
  correlation_id: string
  granted_permissions: string[]
  granted_roles?: string[]
  idempotency_key: string
  incident_id?: string
  input: Record<string, unknown>
  recommendation_id?: string
  requested_by_id: string
  requested_by_type: "agent" | "system" | "user"
  tenant_id?: string
  tool_name: string
  tool_version: string
}

export type ExpireAgentApprovalInput = {
  actor_id: string
  approval_id: string
  expired_at: string
}

export type InventoryRecommendation = {
  action_type: "NO_ACTION" | "INVENTORY_TRANSFER" | "ESCALATE"
  evidence: Record<string, unknown>
  proposal: Record<string, unknown>
  rationale: string
  requires_approval: boolean
  risk_level: RiskLevel
  summary: string
  terminal_status?: "RESOLVED" | "ESCALATED"
}

export type OrderExceptionRecommendation = {
  action_type: "CREATE_TASK" | "NO_ACTION"
  evidence: Record<string, unknown>
  proposal: Record<string, unknown>
  rationale: string
  risk_level: RiskLevel
  summary: string
  terminal_status?: "RESOLVED"
}
