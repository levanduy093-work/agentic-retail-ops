import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
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
} from "../../modules/agent-operations/customer-product-advisor"
import { detectKnowledgeQuestionLocale } from "../../modules/agent-operations/knowledge-answer"

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
    const existingResponse = (
      await service.listAgentMessages(
        { idempotency_key: `customer-answer:${inbound.id}` },
        { take: 1 }
      )
    )[0]
    if (!existingResponse && isPotentialProductRequest(inbound.body)) {
      const locale = detectKnowledgeQuestionLocale(inbound.body)
      let catalogQuery = extractCatalogSearchQuery(inbound.body)
      try {
        const conversation = await service.retrieveAgentConversation(
          inbound.conversation_id
        )
        if (!catalogQuery) {
          const recentInbound = await service.listAgentMessages(
            {
              conversation_id: conversation.id,
              direction: "INBOUND",
            },
            { order: { occurred_at: "DESC" }, take: 6 }
          )
          catalogQuery = extractRecentCatalogSearchQuery(
            recentInbound
              .filter((message) => message.id !== inbound.id)
              .map((message) => ({
                body: message.body,
                direction: message.direction as "INBOUND" | "OUTBOUND",
              }))
          )
        }
        const catalogRead = await executeCatalogRead(
          container,
          {
            limit: 8,
            locale,
            query: catalogQuery,
          },
          { tenant_id: conversation.tenant_id }
        )
        catalogSnapshot = catalogRead.output
      } catch {
        catalogSnapshot = {
          products: [] as [],
          query: catalogQuery ?? null,
          status: "UNAVAILABLE" as const,
          total_count: 0 as const,
        }
      }
    }
    const result = await locking.execute(
      `customer-knowledge-answer:${inbound.conversation_id}`,
      () =>
        service.processCustomerKnowledgeQuestion({
          ...input,
          catalog_snapshot: catalogSnapshot,
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
