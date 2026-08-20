import type { ILockingModule, IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { ProcessCustomerKnowledgeQuestionInput } from "../../modules/agent-operations/types"
import { executeCatalogRead } from "../../modules/agent-operations/catalog-read-runtime"
import {
  extractCatalogSearchQuery,
  extractRecentCatalogSearchQuery,
  isPotentialProductRequest,
  shouldReadCatalogForCustomerMessage,
} from "../../modules/agent-operations/customer-product-advisor"
import { detectKnowledgeQuestionLocale } from "../../modules/agent-operations/knowledge-answer"
import {
  extractCustomerOrderDisplayId,
  getVerifiedLinkedCustomerId,
  isAwaitingCustomerOrderReference,
  shouldReadCustomerFulfillment,
  shouldReadCustomerPayment,
} from "../../modules/agent-operations/customer-order-lookup"
import { executeFulfillmentRead } from "../../modules/agent-operations/fulfillment-read-runtime"
import { executeOrderRead } from "../../modules/agent-operations/order-read-runtime"
import { executePaymentRead } from "../../modules/agent-operations/payment-read-runtime"

const answerCustomerKnowledgeQuestionStep = createStep(
  "answer-customer-knowledge-question",
  async (input: ProcessCustomerKnowledgeQuestionInput, { container }) => {
    const startedAt = Date.now()
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const inbound = await service.retrieveAgentMessage(input.inbound_message_id)
    let catalogSnapshot
    let customerOrderLookup: ProcessCustomerKnowledgeQuestionInput["customer_order_lookup"]
    let customerOrderLookupLocale: "en" | "vi" | undefined
    const existingResponse = (
      await service.listAgentMessages(
        { idempotency_key: `customer-answer:${inbound.id}` },
        { take: 1 }
      )
    )[0]
    if (!existingResponse) {
      const locale = detectKnowledgeQuestionLocale(inbound.body)
      try {
        const conversation = await service.retrieveAgentConversation(
          inbound.conversation_id
        )
        const recentInbound = await service.listAgentMessages(
          {
            conversation_id: conversation.id,
            direction: "INBOUND",
          },
          { order: { occurred_at: "DESC" }, take: 6 }
        )
        const priorInbound = recentInbound.filter(
          (message) => message.id !== inbound.id
        )
        const recentMessages = await service.listAgentMessages(
          { conversation_id: conversation.id },
          { order: { occurred_at: "DESC" }, take: 8 }
        )
        const awaitingOrderReference = isAwaitingCustomerOrderReference(
          recentMessages.filter((message) => message.id !== inbound.id)
        )
        const pendingOrderPrompt = recentMessages
          .filter(
            (message) =>
              message.id !== inbound.id && message.direction === "OUTBOUND"
          )
          .find((message) => {
            const structured = message.structured_content as
              | Record<string, unknown>
              | null
            return structured?.pending_customer_input === "ORDER_REFERENCE"
          })
        const pendingOrderPromptLocale = pendingOrderPrompt?.structured_content
          ? (pendingOrderPrompt.structured_content as Record<string, unknown>)
              .locale
          : undefined
        customerOrderLookupLocale =
          pendingOrderPromptLocale === "en" || pendingOrderPromptLocale === "vi"
            ? pendingOrderPromptLocale
            : undefined
        const explicitDisplayId = extractCustomerOrderDisplayId(inbound.body)
        const displayId =
          explicitDisplayId ??
          (awaitingOrderReference
            ? extractCustomerOrderDisplayId(inbound.body, true)
            : null)
        if (displayId && (awaitingOrderReference || explicitDisplayId)) {
          const metadata = (conversation.metadata ?? {}) as Record<string, unknown>
          const customerId = getVerifiedLinkedCustomerId(metadata)
          if (!customerId) {
            customerOrderLookup = {
              display_id: displayId,
              status: "ACCOUNT_NOT_LINKED",
            }
          } else {
            const query = container.resolve(ContainerRegistrationKeys.QUERY)
            const { data: ordersByDisplayId } = await query.graph({
              entity: "order",
              fields: ["id"],
              filters: {
                customer_id: customerId,
                display_id: String(displayId),
              },
              pagination: { skip: 0, take: 2 },
            })
            if (ordersByDisplayId.length !== 1) {
              customerOrderLookup = { display_id: displayId, status: "NOT_FOUND" }
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
                  version: read.output.version,
                },
                tool_name: read.definition.name,
                tool_version: read.definition.version,
              })
              const fulfillment = shouldReadCustomerFulfillment(inbound.body)
                ? await executeFulfillmentRead(
                    container,
                    { order_id: read.output.order_id },
                    "customer-knowledge-agent"
                  )
                : null
              if (fulfillment) {
                await service.recordCustomerReadToolCall({
                  conversation_id: conversation.id,
                  inbound_message_id: inbound.id,
                  input: fulfillment.input,
                  output: fulfillment.output,
                  tool_name: fulfillment.definition.name,
                  tool_version: fulfillment.definition.version,
                })
              }
              const payment = shouldReadCustomerPayment(inbound.body)
                ? await executePaymentRead(
                    container,
                    { order_id: read.output.order_id },
                    "customer-knowledge-agent"
                  )
                : null
              if (payment) {
                await service.recordCustomerReadToolCall({
                  conversation_id: conversation.id,
                  inbound_message_id: inbound.id,
                  input: payment.input,
                  output: payment.output,
                  tool_name: payment.definition.name,
                  tool_version: payment.definition.version,
                })
              }
              customerOrderLookup = {
                display_id: displayId,
                fulfillment: fulfillment?.output,
                order: read.output,
                payment: payment?.output,
                status: "FOUND",
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
                direction: message.direction as "INBOUND" | "OUTBOUND",
              }))
            )
          let catalogRead = await executeCatalogRead(
            container,
            {
              limit: 8,
              locale,
              query: catalogQuery,
            },
            { tenant_id: conversation.tenant_id }
          )
          if (!catalogRead.output.products.length) {
            catalogRead = await executeCatalogRead(
              container,
              {
                limit: 8,
                locale,
                query: undefined,
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
              total_count: catalogRead.output.total_count,
            },
            tool_name: catalogRead.definition.name,
            tool_version: catalogRead.definition.version,
          })
          catalogSnapshot = catalogRead.output
        }
      } catch {
        if (isPotentialProductRequest(inbound.body)) {
          catalogSnapshot = {
            products: [] as [],
            query: extractCatalogSearchQuery(inbound.body) ?? null,
            status: "UNAVAILABLE" as const,
            total_count: 0 as const,
          }
        }
      }
    }
    const result = await locking.execute(
      `customer-knowledge-answer:${inbound.conversation_id}`,
      () =>
        service.processCustomerMessageAgentic({ inbound_message_id: inbound.id })
    )
    const imageAttachments = (
      (inbound.structured_content ?? {}) as Record<string, unknown>
    ).image_attachments
    const imageUrls = Array.isArray(imageAttachments)
      ? imageAttachments.flatMap((attachment) => {
          if (!attachment || typeof attachment !== "object") return []
          const url = (attachment as Record<string, unknown>).url
          return typeof url === "string" ? [url] : []
        })
      : []
    const visionAnalysis = await service.analyzeCustomerSupportImages({
      caption: inbound.body,
      image_urls: imageUrls,
      inbound_message_id: inbound.id,
      tenant_id: (
        await service.retrieveAgentConversation(inbound.conversation_id)
      ).tenant_id,
    })
    if (visionAnalysis && visionAnalysis.defect_type !== "NONE") {
      const escalation = await service.createCustomerKnowledgeEscalation({
        conversation_id: inbound.conversation_id,
        inbound_message_id: inbound.id,
        locale: detectKnowledgeQuestionLocale(inbound.body),
        question: inbound.body,
        reason: "VISION_REVIEW",
        vision_analysis: visionAnalysis,
      })
      result.support_task_id = escalation.task?.id ?? result.support_task_id
    }

    return new StepResponse({
      ...result,
      response_preparation_ms: Date.now() - startedAt,
    })
  }
)

export const answerCustomerKnowledgeQuestionWorkflow = createWorkflow(
  "answer-customer-knowledge-question",
  function (input: ProcessCustomerKnowledgeQuestionInput) {
    return new WorkflowResponse(answerCustomerKnowledgeQuestionStep(input))
  }
)
