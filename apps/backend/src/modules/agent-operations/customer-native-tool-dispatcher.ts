import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { executeCatalogRead } from "./catalog-read-runtime"
import { ModelToolCall, ToolDefinition } from "./model-gateway"
import { executeOrderRead } from "./order-read-runtime"
import { executeKnowledgeSearchTool } from "./read-tool-runtime"
import { CustomerOrderLookup } from "./customer-order-lookup"
import { CATALOG_READ_TOOL } from "./tools/catalog-tools"
import { KNOWLEDGE_SEARCH_TOOL } from "./tools/platform-read-tools"
import { ORDER_READ_TOOL } from "./tools/order-tools"
import type {
  KnowledgeSearchInput,
  KnowledgeSearchOutput,
} from "./tools/platform-read-tools"

const NativeCatalogSearchInput = z.strictObject({
  query: z.string().trim().min(1).max(160),
})

const NativeKnowledgeSearchInput = z.strictObject({
  query: z.string().trim().min(2).max(500),
})

const NativeOrderStatusInput = z.strictObject({
  order_code: z
    .union([z.string().trim().regex(/^\d{1,12}$/), z.number().int().positive()])
    .transform((value) => Number(value)),
})

export const CUSTOMER_SUPPORT_NATIVE_TOOLS: ToolDefinition[] = [
  {
    description:
      "Search the live published product catalog. Use this before recommending a product or promising availability.",
    name: "search_catalog",
    parameters: {
      additionalProperties: false,
      properties: {
        query: { description: "Customer product need in their own words.", type: "string" },
      },
      required: ["query"],
      type: "object",
    },
  },
  {
    description:
      "Search approved customer-support knowledge for policies, returns, shipping, warranty, and payments.",
    name: "search_knowledge_base",
    parameters: {
      additionalProperties: false,
      properties: {
        query: { description: "The policy or support question to verify.", type: "string" },
      },
      required: ["query"],
      type: "object",
    },
  },
  {
    description:
      "Read the authenticated customer's own order by its display code. Never use this for another customer's order.",
    name: "check_order_status",
    parameters: {
      additionalProperties: false,
      properties: {
        order_code: { description: "The numeric order display code provided by the customer.", type: "string" },
      },
      required: ["order_code"],
      type: "object",
    },
  },
]

export const CUSTOMER_SUPPORT_NATIVE_TOOL_NAMES = new Set(
  CUSTOMER_SUPPORT_NATIVE_TOOLS.map((tool) => tool.name)
)

type CustomerSupportNativeToolService = {
  recordCustomerReadToolCall(input: {
    conversation_id: string
    inbound_message_id: string
    input: Record<string, unknown>
    output: Record<string, unknown>
    tool_name: string
    tool_version: string
  }): Promise<unknown>
  searchGovernedKnowledge(input: KnowledgeSearchInput): Promise<KnowledgeSearchOutput>
}

export type CustomerSupportNativeToolContext = {
  container: MedusaContainer
  conversation_id: string
  customer_id: string | null
  inbound_message_id: string
  locale: "en" | "vi"
  service: CustomerSupportNativeToolService
  tenant_id: string
}

function toOrderLookupResult(
  displayId: number,
  status: CustomerOrderLookup["status"]
) {
  return { display_id: displayId, status }
}

export function createCustomerSupportNativeToolDispatcher(
  context: CustomerSupportNativeToolContext
) {
  return async function executeCustomerSupportNativeTool(
    call: ModelToolCall
  ): Promise<Record<string, unknown>> {
    if (call.name === "search_catalog") {
      const parsed = NativeCatalogSearchInput.parse(call.arguments)
      const result = await executeCatalogRead(
        context.container,
        { limit: 8, locale: context.locale, query: parsed.query },
        { tenant_id: context.tenant_id }
      )
      const output = {
        cache_status: result.cache_status,
        products: result.output.products,
        query: result.output.query,
        status: result.output.status,
        total_count: result.output.total_count,
      }
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: result.input,
        output: {
          cache_status: result.cache_status,
          product_ids: result.output.products.map((product) => product.id),
          total_count: result.output.total_count,
        },
        tool_name: CATALOG_READ_TOOL.name,
        tool_version: CATALOG_READ_TOOL.version,
      })
      return output
    }

    if (call.name === "search_knowledge_base") {
      const parsed = NativeKnowledgeSearchInput.parse(call.arguments)
      const result = await executeKnowledgeSearchTool(
        context.service,
        {
          actor_id: "customer-support-agent",
          granted_permissions: ["agent_knowledge:read"],
        },
        {
          limit: 5,
          locale: context.locale,
          query: parsed.query,
          scope: "customer_support",
          tenant_id: context.tenant_id,
        }
      )
      const output = result.output as Record<string, unknown>
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: result.input,
        output: {
          document_ids: result.output.results.map((item) => item.document_id),
          result_count: result.output.results.length,
          total_candidates: result.output.total_candidates,
        },
        tool_name: KNOWLEDGE_SEARCH_TOOL.name,
        tool_version: KNOWLEDGE_SEARCH_TOOL.version,
      })
      return output
    }

    if (call.name === "check_order_status") {
      const parsed = NativeOrderStatusInput.parse(call.arguments)
      if (!context.customer_id) {
        const output = toOrderLookupResult(
          parsed.order_code,
          "ACCOUNT_NOT_LINKED"
        )
        await context.service.recordCustomerReadToolCall({
          conversation_id: context.conversation_id,
          inbound_message_id: context.inbound_message_id,
          input: { display_id: parsed.order_code },
          output,
          tool_name: ORDER_READ_TOOL.name,
          tool_version: ORDER_READ_TOOL.version,
        })
        return output
      }
      const query = context.container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "order",
        fields: ["id"],
        filters: {
          customer_id: context.customer_id,
          display_id: String(parsed.order_code),
        },
        pagination: { skip: 0, take: 2 },
      })
      if (data.length !== 1) {
        const output = toOrderLookupResult(parsed.order_code, "NOT_FOUND")
        await context.service.recordCustomerReadToolCall({
          conversation_id: context.conversation_id,
          inbound_message_id: context.inbound_message_id,
          input: { display_id: parsed.order_code },
          output,
          tool_name: ORDER_READ_TOOL.name,
          tool_version: ORDER_READ_TOOL.version,
        })
        return output
      }
      const order = await executeOrderRead(
        context.container,
        { order_id: data[0].id },
        "customer-support-agent"
      )
      const output = {
        display_id: parsed.order_code,
        order: order.output,
        status: "FOUND",
      }
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: order.input,
        output: {
          display_id: order.output.display_id,
          fulfillment_status: order.output.fulfillment_status,
          order_status: order.output.order_status,
          payment_status: order.output.payment_status,
          version: order.output.version,
        },
        tool_name: ORDER_READ_TOOL.name,
        tool_version: ORDER_READ_TOOL.version,
      })
      return output
    }

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Customer support tool ${call.name} is not available.`
    )
  }
}
