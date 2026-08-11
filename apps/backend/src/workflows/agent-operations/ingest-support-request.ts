import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import { executeOrderRead } from "../../modules/agent-operations/order-read-runtime"
import { executeKnowledgeSearchTool } from "../../modules/agent-operations/read-tool-runtime"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { executeAgentTool } from "../../modules/agent-operations/tool-executor"
import { AGENT_TOOL_REGISTRY } from "../../modules/agent-operations/tool-registry"
import { OrderReadOutput } from "../../modules/agent-operations/tools/order-tools"
import {
  RESPONSE_DRAFT_TOOL,
  ResponseDraftInput,
  ResponseDraftOutput,
} from "../../modules/agent-operations/tools/response-tools"
import { SupportRequestEventInput } from "../../modules/agent-operations/types"
import { KnowledgeSearchOutput } from "../../modules/agent-operations/tools/platform-read-tools"

const readSupportOrderStep = createStep(
  "read-support-order",
  async (input: { order_id: string }, { container }) => {
    const execution = await executeOrderRead(
      container,
      input,
      "customer-support-agent"
    )

    return new StepResponse(execution.output)
  }
)

const searchSupportKnowledgeStep = createStep(
  "search-support-knowledge",
  async (
    input: { locale: "en" | "vi"; question: string; tenant_id: string },
    { container }
  ) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const execution = await executeKnowledgeSearchTool(
      service,
      {
        actor_id: "customer-support-agent",
        granted_permissions: ["agent_knowledge:read"],
      },
      {
        limit: 5,
        locale: input.locale,
        query: input.question,
        scope: "customer_support",
        tenant_id: input.tenant_id,
      }
    )

    return new StepResponse(execution.output)
  }
)

const draftSupportResponseStep = createStep(
  "draft-support-response",
  async (
    input: {
      event: SupportRequestEventInput
      knowledge: KnowledgeSearchOutput
      order: OrderReadOutput
    },
    { container }
  ) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const execution = await executeAgentTool<
      ResponseDraftInput,
      ResponseDraftOutput
    >(
      AGENT_TOOL_REGISTRY,
      {
        authority: {
          actor_id: "customer-support-agent",
          granted_permissions: ["agent_response:draft"],
          mode: "DIRECT",
        },
        input: {
          knowledge: input.knowledge.results,
          locale: input.event.payload.locale,
          order: input.order,
          question: input.event.payload.question,
          request_type: input.event.payload.request_type,
        },
        tool_name: RESPONSE_DRAFT_TOOL.name,
        tool_version: RESPONSE_DRAFT_TOOL.version,
      },
      async (parsed) =>
        service.draftGovernedCustomerResponse(
          parsed,
          `${input.event.source}:${input.event.event_id}:support-draft-model`,
          input.event.tenant_id
        )
    )

    return new StepResponse(execution.output)
  }
)

const persistSupportRequestStep = createStep(
  "persist-support-request",
  async (
    input: {
      draft: ResponseDraftOutput
      event: SupportRequestEventInput
      knowledge: KnowledgeSearchOutput
      order: OrderReadOutput
    },
    { container }
  ) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.processSupportRequest(
      input.event,
      input.order,
      input.knowledge,
      input.draft
    )

    return new StepResponse(result)
  }
)

export const ingestSupportRequestWorkflow = createWorkflow(
  "ingest-support-request",
  function (input: SupportRequestEventInput) {
    const order = readSupportOrderStep({ order_id: input.payload.order_id })
    const knowledge = searchSupportKnowledgeStep({
      locale: input.payload.locale,
      question: input.payload.question,
      tenant_id: input.tenant_id,
    })
    const draft = draftSupportResponseStep({
      event: input,
      knowledge,
      order,
    })
    const result = persistSupportRequestStep({
      draft,
      event: input,
      knowledge,
      order,
    })

    return new WorkflowResponse(result)
  }
)
