import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"

const IncidentStatus = z.enum([
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
])

const IncidentSnapshot = z.strictObject({
  incident_id: z.string(),
  status: IncidentStatus,
  title: z.string(),
})

const CommandConflict = z.strictObject({
  code: z.string(),
  message: z.string(),
  outcome: z.literal("CONFLICT"),
})

export const IncidentCreateInput = z.strictObject({
  context: z.record(z.string(), z.unknown()).optional(),
  incident_type: z.string().trim().min(1).max(100),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  subject_id: z.string().trim().min(1),
  subject_type: z.string().trim().min(1),
  summary: z.string().trim().max(4_000).optional(),
  title: z.string().trim().min(1).max(500),
  trigger_event_id: z.string().trim().min(1),
})

export const IncidentUpdateInput = z.strictObject({
  context: z.record(z.string(), z.unknown()).optional(),
  expected_status: IncidentStatus,
  incident_id: z.string().trim().min(1),
  owner_id: z.string().trim().min(1).optional(),
  resolution: z.string().trim().min(3).max(4_000).optional(),
  status: IncidentStatus,
  summary: z.string().trim().max(4_000).optional(),
})

const IncidentCommandOutput = z.union([
  z.strictObject({
    duplicate: z.boolean(),
    incident: IncidentSnapshot,
    outcome: z.literal("SUCCEEDED"),
  }),
  CommandConflict,
])

export const ApprovalRequestInput = z.strictObject({
  expires_at: z.string().datetime(),
  incident_id: z.string().trim().min(1),
  policy_key: z.string().trim().min(1),
  policy_version: z.string().trim().min(1),
  recommendation_id: z.string().trim().min(1),
  required_role: z.string().trim().min(1),
})

export const ApprovalDecideInput = z.strictObject({
  approval_id: z.string().trim().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().min(3).max(1_000),
})

const ApprovalCommandOutput = z.union([
  z.strictObject({
    approval_id: z.string(),
    duplicate: z.boolean(),
    outcome: z.literal("SUCCEEDED"),
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  }),
  CommandConflict,
])

export const KnowledgeProposeInput = z.strictObject({
  citation_locator: z.string().trim().min(1).max(1_000),
  content: z.string().trim().min(1).max(100_000),
  document_key: z.string().trim().min(1).max(200),
  effective_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  locale: z.string().trim().min(2).max(20).default("vi"),
  scope: z.string().trim().min(1).max(100).default("operations"),
  tenant_id: z.string().trim().min(1).default("default"),
  title: z.string().trim().min(1).max(500),
  version: z.string().trim().min(1).max(50),
})

const KnowledgeProposeOutput = z.strictObject({
  document_id: z.string(),
  duplicate: z.boolean(),
  outcome: z.literal("SUCCEEDED"),
  status: z.literal("DRAFT"),
})

export const MessageSendInput = z.strictObject({
  body: z.string().trim().min(1).max(4_000),
  conversation_id: z.string().trim().min(1),
  message_type: z.enum(["TEXT", "NOTIFICATION"]).default("TEXT"),
  structured_content: z.record(z.string(), z.unknown()).optional(),
})

export const DraftCartCreateInput = z.strictObject({
  conversation_id: z.string().trim().min(1),
  customer_confirmation_message_id: z.string().trim().min(1),
  items: z
    .array(
      z.strictObject({
        quantity: z.number().int().min(1).max(10),
        variant_id: z.string().trim().min(1),
      })
    )
    .min(1)
    .max(10),
  region_id: z.string().trim().min(1),
  sales_channel_id: z.string().trim().min(1),
})

export const CartHandoffSendInput = z.strictObject({
  body: z.string().trim().min(1).max(4_000),
  cart_id: z.string().trim().min(1),
  conversation_id: z.string().trim().min(1),
})

const DraftCartCreateOutput = z.union([
  z.strictObject({
    cart_id: z.string(),
    duplicate: z.boolean(),
    outcome: z.literal("SUCCEEDED"),
    status: z.literal("DRAFT"),
  }),
  CommandConflict,
])

const CartHandoffSendOutput = z.union([
  z.strictObject({
    cart_id: z.string(),
    duplicate: z.boolean(),
    message_id: z.string(),
    outcome: z.literal("SUCCEEDED"),
    status: z.literal("AVAILABLE"),
  }),
  CommandConflict,
])

const MessageSendOutput = z.union([
  z.strictObject({
    delivery_id: z.string().optional(),
    duplicate: z.boolean(),
    message_id: z.string(),
    outcome: z.literal("SUCCEEDED"),
    status: z.literal("AVAILABLE"),
  }),
  CommandConflict,
])

const commandDefaults = {
  idempotency: "REQUIRED" as const,
  kind: "COMMAND" as const,
  retry: {
    backoff: "EXPONENTIAL" as const,
    base_delay_ms: 1_000,
    max_attempts: 3,
    max_delay_ms: 60_000,
  },
  timeout_ms: 10_000,
  version: "1.0.0",
}

export const INCIDENT_CREATE_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: false,
  audit_fields: ["trigger_event_id", "incident_type", "priority"],
  description: "Create an incident grounded in a durable canonical event.",
  error_codes: ["ACTION_GATE_REJECTED", "INCIDENT_EVENT_CONFLICT"],
  input_schema: IncidentCreateInput,
  name: "incident.create",
  output_schema: IncidentCommandOutput,
  permission: "agent_incident:create",
  required_role: null,
  risk_level: "LOW",
})

export const INCIDENT_UPDATE_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: false,
  audit_fields: ["incident_id", "expected_status", "status"],
  description: "Update an incident with optimistic state validation.",
  error_codes: ["ACTION_GATE_REJECTED", "INCIDENT_STATE_CONFLICT"],
  input_schema: IncidentUpdateInput,
  name: "incident.update",
  output_schema: IncidentCommandOutput,
  permission: "agent_incident:update",
  required_role: null,
  risk_level: "MEDIUM",
})

export const APPROVAL_REQUEST_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: false,
  audit_fields: ["incident_id", "recommendation_id", "required_role"],
  description: "Request human approval for a governed recommendation.",
  error_codes: ["ACTION_GATE_REJECTED", "APPROVAL_STATE_CONFLICT"],
  input_schema: ApprovalRequestInput,
  name: "approval.request",
  output_schema: ApprovalCommandOutput,
  permission: "agent_approval:create",
  required_role: null,
  risk_level: "MEDIUM",
})

export const APPROVAL_DECIDE_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: false,
  audit_fields: ["approval_id", "decision", "reason"],
  description: "Record a human approval decision through the Action Gateway.",
  error_codes: ["ACTION_GATE_REJECTED", "APPROVAL_STATE_CONFLICT"],
  input_schema: ApprovalDecideInput,
  name: "approval.decide",
  output_schema: ApprovalCommandOutput,
  permission: "agent_approval:approve",
  required_role: "operations_manager",
  risk_level: "HIGH",
})

export const KNOWLEDGE_PROPOSE_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: false,
  audit_fields: ["document_key", "version", "citation_locator"],
  description: "Propose cited knowledge as a draft that cannot be used yet.",
  error_codes: ["ACTION_GATE_REJECTED", "KNOWLEDGE_PROPOSE_FAILED"],
  input_schema: KnowledgeProposeInput,
  name: "knowledge.propose",
  output_schema: KnowledgeProposeOutput,
  permission: "agent_knowledge:create",
  required_role: null,
  risk_level: "LOW",
})

export const MESSAGE_SEND_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: false,
  audit_fields: ["conversation_id", "message_type"],
  description: "Queue an outbound message in an existing open conversation.",
  error_codes: ["ACTION_GATE_REJECTED", "CONVERSATION_STATE_CONFLICT"],
  input_schema: MessageSendInput,
  name: "message.send",
  output_schema: MessageSendOutput,
  permission: "agent_message:create",
  required_role: null,
  risk_level: "LOW",
})

export const DRAFT_CART_CREATE_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: true,
  audit_fields: [
    "conversation_id",
    "customer_confirmation_message_id",
    "region_id",
    "sales_channel_id",
  ],
  description:
    "Create a Medusa draft cart only after the authenticated customer confirms the selected variants and an operations manager approves the request.",
  error_codes: [
    "ACTION_GATE_REJECTED",
    "CUSTOMER_CONFIRMATION_REQUIRED",
    "DRAFT_CART_CREATE_FAILED",
  ],
  input_schema: DraftCartCreateInput,
  name: "cart.create-draft",
  output_schema: DraftCartCreateOutput,
  permission: "agent_action:create",
  required_role: "operations_manager",
  risk_level: "MEDIUM",
})

export const CART_HANDOFF_SEND_TOOL = defineAgentTool({
  ...commandDefaults,
  approval_required: false,
  audit_fields: ["conversation_id", "cart_id"],
  description:
    "Deliver an approved draft cart only to the verified customer who owns it in the current in-app conversation.",
  error_codes: [
    "ACTION_GATE_REJECTED",
    "CART_HANDOFF_NOT_AVAILABLE",
    "CUSTOMER_CONFIRMATION_REQUIRED",
  ],
  input_schema: CartHandoffSendInput,
  name: "cart.send-handoff",
  output_schema: CartHandoffSendOutput,
  permission: "agent_message:create",
  required_role: null,
  risk_level: "LOW",
})

export type PlatformCommandOutput = z.infer<
  | typeof IncidentCommandOutput
  | typeof ApprovalCommandOutput
  | typeof KnowledgeProposeOutput
  | typeof MessageSendOutput
  | typeof DraftCartCreateOutput
  | typeof CartHandoffSendOutput
>
