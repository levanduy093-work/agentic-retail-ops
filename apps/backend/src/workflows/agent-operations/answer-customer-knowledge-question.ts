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
} from "../../modules/agent-operations/customer-order-lookup"
import { executeOrderRead } from "../../modules/agent-operations/order-read-runtime"

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
              filters: { display_id: String(displayId) },
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
              customerOrderLookup =
                read.output.customer_id === customerId
                  ? { display_id: displayId, order: read.output, status: "FOUND" }
                  : { display_id: displayId, status: "NOT_OWNER" }
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
        service.processCustomerKnowledgeQuestion({
          ...input,
          catalog_snapshot: catalogSnapshot,
          customer_order_lookup: customerOrderLookup,
          customer_order_lookup_locale: customerOrderLookupLocale,
        })
    )

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
