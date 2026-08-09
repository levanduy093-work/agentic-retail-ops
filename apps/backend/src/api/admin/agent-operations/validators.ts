import { z } from "@medusajs/framework/zod"

export const AdminIngestInventoryLowEvent = z.object({
  causation_id: z.string().min(1).optional(),
  correlation_id: z.string().min(1),
  event_id: z.string().min(1),
  event_type: z.literal("inventory.low"),
  event_version: z.number().int().positive().default(1),
  occurred_at: z.string().datetime(),
  payload: z.object({
    alternative_locations: z
      .array(
        z.object({
          available_quantity: z.number().int().nonnegative(),
          location_id: z.string().min(1),
        })
      )
      .default([]),
    available_quantity: z.number().int().nonnegative(),
    inventory_item_id: z.string().min(1),
    location_id: z.string().min(1),
    required_quantity: z.number().int().positive(),
  }),
  source: z.string().min(1),
  subject_id: z.string().min(1),
  subject_type: z.literal("inventory_item"),
  tenant_id: z.string().min(1).default("default"),
})

export const AdminDecideAgentApproval = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().min(3).max(1000),
})

export const AdminSendAgentConversationMessage = z.strictObject({
  body: z.string().trim().min(1).max(4000),
  client_message_id: z.string().trim().min(1).max(200),
  command: z.strictObject({
    approval_id: z.string().trim().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    name: z.literal("APPROVAL_DECISION"),
    reason: z.string().trim().min(3).max(1000),
  }),
  message_type: z.literal("COMMAND"),
})

export const AdminCreateAgentTask = z.strictObject({
  description: z.string().trim().max(4000).optional(),
  due_at: z.string().datetime().optional(),
  idempotency_key: z.string().trim().min(1).max(200),
  incident_id: z.string().trim().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  task_type: z.string().trim().min(1).max(100),
  tenant_id: z.string().trim().min(1).default("default"),
  title: z.string().trim().min(1).max(500),
})

export const AdminTransitionAgentTask = z.strictObject({
  assigned_to_id: z.string().trim().min(1).optional(),
  assigned_to_type: z.enum(["agent", "team", "user"]).optional(),
  expected_status: z.enum([
    "TODO",
    "CLAIMED",
    "IN_PROGRESS",
    "WAITING",
    "COMPLETED",
    "CANCELLED",
    "FAILED",
    "DEAD",
  ]),
  failure: z.string().trim().max(4000).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  status: z.enum([
    "TODO",
    "CLAIMED",
    "IN_PROGRESS",
    "WAITING",
    "COMPLETED",
    "CANCELLED",
    "FAILED",
    "DEAD",
  ]),
})

export const AdminCreateKnowledgeDocument = z.strictObject({
  citation_locator: z.string().trim().min(1).max(1000),
  content: z.string().trim().min(1).max(100000),
  document_key: z.string().trim().min(1).max(200),
  effective_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
  locale: z.string().trim().min(2).max(20).default("vi"),
  scope: z.string().trim().min(1).max(100).default("operations"),
  tenant_id: z.string().trim().min(1).default("default"),
  title: z.string().trim().min(1).max(500),
  version: z.string().trim().min(1).max(50),
})

export const AdminRunAgentEvaluation = z.strictObject({
  idempotency_key: z.string().trim().min(1).max(200),
  observed: z.record(z.string(), z.unknown()),
  scenario_id: z.string().trim().min(1),
})

export type AdminIngestInventoryLowEventType = z.infer<
  typeof AdminIngestInventoryLowEvent
>
export type AdminDecideAgentApprovalType = z.infer<
  typeof AdminDecideAgentApproval
>
export type AdminSendAgentConversationMessageType = z.infer<
  typeof AdminSendAgentConversationMessage
>
export type AdminCreateAgentTaskType = z.infer<typeof AdminCreateAgentTask>
export type AdminTransitionAgentTaskType = z.infer<
  typeof AdminTransitionAgentTask
>
export type AdminCreateKnowledgeDocumentType = z.infer<
  typeof AdminCreateKnowledgeDocument
>
export type AdminRunAgentEvaluationType = z.infer<
  typeof AdminRunAgentEvaluation
>
