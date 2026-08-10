import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"
import { KnowledgeSearchResult } from "./platform-read-tools"
import { OrderReadOutput } from "./order-tools"

export const ResponseDraftInput = z.strictObject({
  knowledge: z.array(KnowledgeSearchResult).max(5),
  locale: z.enum(["en", "vi"]).default("vi"),
  order: OrderReadOutput,
  question: z.string().trim().min(2).max(2_000),
  request_type: z.literal("ORDER_STATUS"),
})

export const ResponseDraftOutput = z.strictObject({
  body: z.string().min(1).max(4_000),
  citations: z.array(
    z.strictObject({
      document_id: z.string().min(1),
      locator: z.string().min(1),
      quote_checksum: z.string().min(1),
      version: z.string().min(1),
    })
  ),
  grounded: z.boolean(),
  requires_human_review: z.literal(true),
})

export type ResponseDraftInput = z.infer<typeof ResponseDraftInput>
export type ResponseDraftOutput = z.infer<typeof ResponseDraftOutput>

export const RESPONSE_DRAFT_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "order.order_id",
    "request_type",
    "citations",
    "requires_human_review",
  ],
  description:
    "Create a cited customer-response draft that must be reviewed by a human.",
  error_codes: ["INVALID_TOOL_INPUT", "RESPONSE_DRAFT_FAILED"],
  idempotency: "NOT_REQUIRED",
  input_schema: ResponseDraftInput,
  kind: "READ",
  name: "response.draft",
  output_schema: ResponseDraftOutput,
  permission: "agent_response:draft",
  required_role: null,
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 250,
    max_attempts: 2,
    max_delay_ms: 1_000,
  },
  risk_level: "READ_ONLY",
  timeout_ms: 5_000,
  version: "1.0.0",
})

export function draftCustomerResponse(
  input: ResponseDraftInput
): ResponseDraftOutput {
  const parsed = ResponseDraftInput.parse(input)
  const orderLabel = `#${parsed.order.display_id}`
  const statusLine =
    parsed.locale === "vi"
      ? `Đơn hàng ${orderLabel} hiện có trạng thái ${parsed.order.order_status}; thanh toán ${parsed.order.payment_status}; giao hàng ${parsed.order.fulfillment_status}.`
      : `Order ${orderLabel} is currently ${parsed.order.order_status}; payment is ${parsed.order.payment_status}; fulfillment is ${parsed.order.fulfillment_status}.`
  const citations = parsed.knowledge.map((result) => ({
    document_id: result.document_id,
    locator: result.citation_locator,
    quote_checksum: result.quote_checksum,
    version: result.version,
  }))
  const knowledgeLine = parsed.knowledge[0]
    ? parsed.locale === "vi"
      ? `Hướng dẫn liên quan: ${parsed.knowledge[0].excerpt}`
      : `Relevant guidance: ${parsed.knowledge[0].excerpt}`
    : parsed.locale === "vi"
      ? "Chưa có tài liệu đã duyệt phù hợp; nhân viên CSKH cần kiểm tra thủ công trước khi trả lời."
      : "No matching approved guidance was found; customer support must review this request manually."

  return {
    body: `${statusLine}\n\n${knowledgeLine}`,
    citations,
    grounded: citations.length > 0,
    requires_human_review: true,
  }
}
