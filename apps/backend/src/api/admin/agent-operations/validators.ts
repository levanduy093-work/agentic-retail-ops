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

export const AdminIngestOrderExceptionEvent = z
  .strictObject({
    causation_id: z.string().min(1).optional(),
    correlation_id: z.string().min(1),
    event_id: z.string().min(1),
    event_type: z.literal("order.exception"),
    event_version: z.number().int().positive().default(1),
    occurred_at: z.string().datetime(),
    payload: z.strictObject({
      details: z.record(z.string(), z.unknown()).optional(),
      detected_at: z.string().datetime(),
      exception_type: z.enum([
        "FULFILLMENT_OVERDUE",
        "MANUAL_REVIEW",
        "PAYMENT_STUCK",
      ]),
      order_id: z.string().min(1),
      sla_due_at: z.string().datetime().optional(),
    }),
    source: z.string().min(1),
    subject_id: z.string().min(1),
    subject_type: z.literal("order"),
    tenant_id: z.string().min(1).default("default"),
  })
  .superRefine((value, context) => {
    if (value.subject_id !== value.payload.order_id) {
      context.addIssue({
        code: "custom",
        message: "subject_id must match payload.order_id",
        path: ["subject_id"],
      })
    }
  })

export const AdminIngestSupportRequest = z
  .strictObject({
    causation_id: z.string().min(1).optional(),
    correlation_id: z.string().min(1),
    event_id: z.string().min(1),
    event_type: z.literal("support.requested"),
    event_version: z.number().int().positive().default(1),
    occurred_at: z.string().datetime(),
    payload: z.strictObject({
      customer_id: z.string().min(1),
      locale: z.enum(["en", "vi"]).default("vi"),
      order_id: z.string().min(1),
      question: z.string().trim().min(2).max(2_000),
      request_type: z.literal("ORDER_STATUS"),
      requested_at: z.string().datetime(),
    }),
    source: z.string().min(1),
    subject_id: z.string().min(1),
    subject_type: z.literal("order"),
    tenant_id: z.string().min(1).default("default"),
  })
  .superRefine((value, context) => {
    if (value.subject_id !== value.payload.order_id) {
      context.addIssue({
        code: "custom",
        message: "subject_id must match payload.order_id",
        path: ["subject_id"],
      })
    }
  })

export const AdminCreateSupportSimulatorMessage = z.strictObject({
  client_message_id: z.string().trim().min(1).max(200),
  customer_id: z.string().trim().min(1),
  locale: z.enum(["en", "vi"]).default("vi"),
  order_id: z.string().trim().min(1),
  question: z.string().trim().min(2).max(2_000),
})

export type AdminCreateSupportSimulatorMessageType = z.infer<
  typeof AdminCreateSupportSimulatorMessage
>

export const AdminSendSupportSimulatorReply = z.strictObject({
  expected_task_updated_at: z.string().datetime(),
})

export const TelegramWebhookUpdate = z.object({
  message: z
    .object({
      chat: z.object({
        id: z.number().int(),
        type: z.string(),
      }),
      date: z.number().int().nonnegative(),
      from: z
        .object({
          first_name: z.string().optional(),
          id: z.number().int(),
          is_bot: z.boolean(),
          last_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
      message_id: z.number().int(),
      text: z.string().trim().min(1).max(4_000).optional(),
    })
    .optional(),
  update_id: z.number().int().nonnegative(),
})

export type TelegramWebhookUpdateType = z.infer<typeof TelegramWebhookUpdate>

export type AdminSendSupportSimulatorReplyType = z.infer<
  typeof AdminSendSupportSimulatorReply
>

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

export const AdminSearchKnowledge = z.strictObject({
  limit: z.number().int().min(1).max(20).default(5),
  locale: z.string().trim().min(2).max(20).optional(),
  query: z.string().trim().min(2).max(500),
  scope: z.string().trim().min(1).max(100).optional(),
  tenant_id: z.string().trim().min(1).default("default"),
})

export const AdminRetireKnowledgeDocument = z.strictObject({
  reason: z.string().trim().min(3).max(1000),
})

export const AdminCreateKnowledgeSource = z.strictObject({
  locale: z.enum(["en", "vi"]),
  name: z.string().trim().min(2).max(200),
  scope: z.string().trim().min(1).max(100).default("customer_support"),
  source_type: z.enum([
    "GOOGLE_DOC",
    "GOOGLE_DRIVE",
    "GOOGLE_SHEET",
    "HTTPS_TEXT",
  ]),
  source_url: z.url().max(2000),
  tenant_id: z.string().trim().min(1).default("default"),
})

// Medusa makes top-level ZodObject query schemas strict before parsing. Google
// may append provider-owned callback fields such as iss, scope, authuser and
// prompt, so wrap the object in a transform and retain only fields we consume.
export const AdminGoogleKnowledgeOAuthCallback = z
  .object({
    code: z.string().trim().min(1).optional(),
    error: z.string().trim().min(1).max(200).optional(),
    state: z.string().trim().min(1).max(4_000).optional(),
  })
  .transform((callback) => callback)

export const AdminRunAgentEvaluation = z.strictObject({
  idempotency_key: z.string().trim().min(1).max(200),
  observed: z.record(z.string(), z.unknown()),
  scenario_id: z.string().trim().min(1),
})

export const AdminRequestAgentAction = z.strictObject({
  approval_id: z.string().trim().min(1).optional(),
  correlation_id: z.string().trim().min(1).max(200),
  idempotency_key: z.string().trim().min(1).max(300),
  incident_id: z.string().trim().min(1).optional(),
  input: z.record(z.string(), z.unknown()),
  recommendation_id: z.string().trim().min(1).optional(),
  tenant_id: z.string().trim().min(1).default("default"),
  tool_name: z.string().trim().min(1).max(200),
  tool_version: z.string().trim().min(1).max(50),
})

export type AdminIngestInventoryLowEventType = z.infer<
  typeof AdminIngestInventoryLowEvent
>
export type AdminIngestOrderExceptionEventType = z.infer<
  typeof AdminIngestOrderExceptionEvent
>
export type AdminIngestSupportRequestType = z.infer<
  typeof AdminIngestSupportRequest
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
export type AdminSearchKnowledgeType = z.infer<typeof AdminSearchKnowledge>
export type AdminRetireKnowledgeDocumentType = z.infer<
  typeof AdminRetireKnowledgeDocument
>
export type AdminCreateKnowledgeSourceType = z.infer<
  typeof AdminCreateKnowledgeSource
>
export type AdminGoogleKnowledgeOAuthCallbackType = z.infer<
  typeof AdminGoogleKnowledgeOAuthCallback
>
export type AdminRunAgentEvaluationType = z.infer<
  typeof AdminRunAgentEvaluation
>
export type AdminRequestAgentActionType = z.infer<
  typeof AdminRequestAgentAction
>
