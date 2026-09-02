import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { executeCatalogRead } from "./catalog-read-runtime"
import { executeCatalogRealtimeStockCheck } from "./catalog-realtime-stock-runtime"
import { executeFulfillmentRead } from "./fulfillment-read-runtime"
import { ModelToolCall, ToolDefinition } from "./model-gateway"
import { executeOrderRead, executeOrderSearch } from "./order-read-runtime"
import { executeKnowledgeSearchTool } from "./read-tool-runtime"
import { CustomerOrderLookup } from "./customer-order-lookup"
import {
  CATALOG_READ_TOOL,
  CATALOG_REALTIME_STOCK_TOOL,
  CatalogRealtimeStockInput,
} from "./tools/catalog-tools"
import { KNOWLEDGE_SEARCH_TOOL } from "./tools/platform-read-tools"
import { ORDER_READ_TOOL, ORDER_SEARCH_TOOL } from "./tools/order-tools"
import { FULFILLMENT_READ_TOOL } from "./tools/fulfillment-tools"
import { SHIPPING_ESTIMATE_TOOL } from "./tools/shipping-tools"
import { executeShippingEstimate } from "./shipping-estimate-runtime"
import {
  DraftCartCreateInput,
  OrderCancelProposeInput,
  OrderUpdateAddressProposeInput,
  ReturnProposeInput,
} from "./tools/platform-command-tools"
import type {
  KnowledgeSearchInput,
  KnowledgeSearchOutput,
} from "./tools/platform-read-tools"
import {
  CatalogAttributeSearchInput,
  OutfitComposeInput,
  TravelLocationResolveInput,
  TravelPackingChecklistInput,
  WeatherClimateInput,
  WeatherForecastInput,
  CATALOG_ATTRIBUTE_SEARCH_TOOL,
  OUTFIT_COMPOSE_TOOL,
  TRAVEL_LOCATION_RESOLVE_TOOL,
  TRAVEL_PACKING_CHECKLIST_TOOL,
  WEATHER_CLIMATE_TOOL,
  WEATHER_FORECAST_TOOL,
  type TravelLocation,
  type WeatherClimateOutput,
  type WeatherForecastOutput,
} from "./tools/travel-tools"
import {
  buildTravelPackingChecklist,
  composeTravelOutfit,
  filterCatalogByTravelAttributes,
  getTravelClimateNormals,
  getTravelWeatherForecast,
  resolveTravelLocation,
} from "./travel-advisor-runtime"
import type { CustomerCatalogSnapshot } from "./customer-product-advisor"

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

const NativeOrderSearchInput = z.strictObject({
  email: z.string().trim().min(3).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  query: z.string().trim().min(1).max(100).optional(),
})

const NativeDraftCartProposalInput = DraftCartCreateInput
const NativeReturnProposalInput = ReturnProposeInput
const NativeOrderCancelProposalInput = OrderCancelProposeInput
const NativeOrderUpdateAddressProposalInput = OrderUpdateAddressProposeInput
const NativeRealtimeStockInput = CatalogRealtimeStockInput
const NativeDeliveryStatusInput = NativeOrderStatusInput
const NativeShippingEstimateInput = z.strictObject({
  destination_location: z.string().trim().min(2).max(200),
  weight: z.number().int().positive().optional(),
})

export const CUSTOMER_SUPPORT_NATIVE_TOOLS: ToolDefinition[] = [
  {
    description:
      "Estimate shipping delivery time (number of days and expected delivery date) and shipping fee to a destination province/city or district in Vietnam using Giao Hàng Nhanh (GHN). Use this whenever a customer asks about shipping duration, when their order will arrive in a province (e.g. Sóc Trăng, Đà Nẵng, Hà Nội), or shipping costs before placing an order.",
    name: "estimate_shipping_delivery",
    parameters: {
      additionalProperties: false,
      properties: {
        destination_location: {
          description:
            "Customer's destination province, city, or district in Vietnam (e.g., 'Sóc Trăng', 'Đà Nẵng', 'Hà Nội', 'Cần Thơ').",
          type: "string",
        },
        weight: {
          description: "Package weight in grams, default is 150g.",
          type: "integer",
        },
      },
      required: ["destination_location"],
      type: "object",
    },
  },
  {
    description:
      "Search and locate customer orders by phone number, email address, customer name, or keywords. Use this whenever the customer does not have or does not remember their numeric order code.",
    name: "search_orders",
    parameters: {
      additionalProperties: false,
      properties: {
        email: { description: "Customer email used for the order.", type: "string" },
        phone: { description: "Customer phone number used for the order.", type: "string" },
        query: { description: "Customer name or product keyword.", type: "string" },
      },
      type: "object",
    },
  },
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
      "Resolve a travel destination explicitly stated by the customer. If multiple candidates are returned, ask the customer which city/area they mean before reading weather.",
    name: "resolve_travel_location",
    parameters: {
      additionalProperties: false,
      properties: {
        country_code: { description: "Optional ISO 2-letter country code only when known.", type: "string" },
        query: { description: "Destination text stated by the customer.", type: "string" },
      },
      required: ["query"],
      type: "object",
    },
  },
  {
    description:
      "Read a real dated weather forecast after resolving one unambiguous travel location. Use only for dates within the next 16 days; otherwise use get_climate_normals.",
    name: "get_weather_forecast",
    parameters: {
      additionalProperties: false,
      properties: {
        end_date: { description: "Trip end date in YYYY-MM-DD.", type: "string" },
        start_date: { description: "Trip start date in YYYY-MM-DD.", type: "string" },
      },
      required: ["start_date", "end_date"],
      type: "object",
    },
  },
  {
    description:
      "Read three-year historical climate evidence for a resolved destination when trip dates are outside the forecast horizon. Never describe this output as a forecast.",
    name: "get_climate_normals",
    parameters: {
      additionalProperties: false,
      properties: {
        end_date: { description: "Trip end date in YYYY-MM-DD.", type: "string" },
        start_date: { description: "Trip start date in YYYY-MM-DD.", type: "string" },
      },
      required: ["start_date", "end_date"],
      type: "object",
    },
  },
  {
    description:
      "Search and hard-filter the live catalog by size, budget, activity and travel-weather needs. Use after weather evidence is available, or after the customer confirms they only want general travel clothing advice.",
    name: "search_catalog_by_attributes",
    parameters: {
      additionalProperties: false,
      properties: {
        activity: { type: "string" },
        max_budget: { type: "number" },
        query: { type: "string" },
        size: { type: "string" },
        style: { type: "string" },
        weather_needs: {
          items: { enum: ["BREATHABLE", "RAIN_PROTECTION", "SUN_PROTECTION", "WARM_LAYER", "WIND_PROTECTION"], type: "string" },
          type: "array",
        },
      },
      required: ["query"],
      type: "object",
    },
  },
  {
    description:
      "Compose one bounded outfit only from live products returned by search_catalog_by_attributes in this turn.",
    name: "compose_travel_outfit",
    parameters: {
      additionalProperties: false,
      properties: {
        activity: { type: "string" },
        max_items: { type: "integer" },
        style: { type: "string" },
      },
      type: "object",
    },
  },
  {
    description:
      "Build a concise travel packing checklist. It clearly separates items to bring from home from verified store products.",
    name: "build_travel_packing_checklist",
    parameters: {
      additionalProperties: false,
      properties: {
        activity: { type: "string" },
        trip_days: { type: "integer" },
      },
      type: "object",
    },
  },
  {
    description:
      "Create a human-review proposal for a return, exchange, or refund request on the authenticated customer's own order. Use only after the current customer explicitly requests it and gives the order code. This never creates a return or refund.",
    name: "propose_return_review",
    parameters: {
      additionalProperties: false,
      properties: {
        conversation_id: { type: "string" },
        customer_confirmation_message_id: { type: "string" },
        order_code: { type: "string" },
        reason: { type: "string" },
        requested_resolution: {
          enum: ["EXCHANGE", "REFUND", "RETURN"],
          type: "string",
        },
      },
      required: [
        "conversation_id",
        "customer_confirmation_message_id",
        "order_code",
        "reason",
        "requested_resolution",
      ],
      type: "object",
    },
  },
  {
    description:
      "Create a human-review proposal to cancel an authenticated customer's unfulfilled order. Use only after the current customer explicitly requests cancellation and gives the order code. This never cancels an order autonomously.",
    name: "propose_order_cancellation",
    parameters: {
      additionalProperties: false,
      properties: {
        conversation_id: { type: "string" },
        customer_confirmation_message_id: { type: "string" },
        order_code: { type: "string" },
        reason: { type: "string" },
      },
      required: [
        "conversation_id",
        "customer_confirmation_message_id",
        "order_code",
        "reason",
      ],
      type: "object",
    },
  },
  {
    description:
      "Create a human-review proposal to update the shipping address for an authenticated customer's unfulfilled order before delivery dispatch. Use only after the current customer explicitly provides the new address details.",
    name: "propose_address_change",
    parameters: {
      additionalProperties: false,
      properties: {
        address_1: { type: "string" },
        city: { type: "string" },
        conversation_id: { type: "string" },
        customer_confirmation_message_id: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        order_code: { type: "string" },
        phone: { type: "string" },
        province: { type: "string" },
        reason: { type: "string" },
      },
      required: [
        "address_1",
        "city",
        "conversation_id",
        "customer_confirmation_message_id",
        "order_code",
        "reason",
      ],
      type: "object",
    },
  },
  {
    description:
      "Check live stock for a public product or exact variant immediately before promising availability or preparing a cart. Use an exact variant_id from search_catalog whenever one is available.",
    name: "check_realtime_stock",
    parameters: {
      additionalProperties: false,
      properties: {
        color: { type: "string" },
        product_id: { type: "string" },
        quantity: { type: "integer" },
        size: { type: "string" },
        variant_id: { type: "string" },
      },
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
  {
    description:
      "Read live delivery, carrier, and tracking facts for the authenticated customer's own order. Use this instead of estimating where a shipment is or when it will arrive.",
    name: "check_delivery_status",
    parameters: {
      additionalProperties: false,
      properties: {
        order_code: { description: "The numeric order display code provided by the customer.", type: "string" },
      },
      required: ["order_code"],
      type: "object",
    },
  },
  {
    description:
      "Propose a customer draft cart for manager approval only after the authenticated customer explicitly confirms exact variant IDs in their current message. This never creates a cart. Use only when you have the exact confirmation message id, region id, sales channel id, and published variant ids from trusted tool context.",
    name: "propose_draft_cart",
    parameters: {
      additionalProperties: false,
      properties: {
        conversation_id: { type: "string" },
        customer_confirmation_message_id: { type: "string" },
        items: {
          items: {
            additionalProperties: false,
            properties: {
              quantity: { type: "integer" },
              variant_id: { type: "string" },
            },
            required: ["quantity", "variant_id"],
            type: "object",
          },
          type: "array",
        },
        region_id: { type: "string" },
        sales_channel_id: { type: "string" },
      },
      required: [
        "conversation_id",
        "customer_confirmation_message_id",
        "items",
        "region_id",
        "sales_channel_id",
      ],
      type: "object",
    },
  },
]

export const CUSTOMER_SUPPORT_NATIVE_TOOL_NAMES = new Set(
  CUSTOMER_SUPPORT_NATIVE_TOOLS.map((tool) => tool.name)
)

export const CUSTOMER_SUPPORT_VERIFIED_CUSTOMER_TOOL_NAMES = new Set([
  "check_delivery_status",
  "check_order_status",
  "propose_address_change",
  "propose_draft_cart",
  "propose_order_cancellation",
  "propose_return_review",
  "search_orders",
])

export function getCustomerSupportNativeTools(customerId: string | null) {
  return customerId
    ? CUSTOMER_SUPPORT_NATIVE_TOOLS
    : CUSTOMER_SUPPORT_NATIVE_TOOLS.filter(
        (tool) => !CUSTOMER_SUPPORT_VERIFIED_CUSTOMER_TOOL_NAMES.has(tool.name)
      )
}

type CustomerSupportNativeToolService = {
  recordCustomerReadToolCall(input: {
    conversation_id: string
    inbound_message_id: string
    input: Record<string, unknown>
    output: Record<string, unknown>
    tool_name: string
    tool_version: string
  }): Promise<unknown>
  proposeCustomerDraftCart(input: Record<string, unknown>): Promise<{
    approval: { id: string } | null
    duplicate: boolean
    incident: { id: string } | null
    recommendation: { id: string } | null
  }>
  proposeCustomerReturnReview(input: Record<string, unknown>): Promise<{
    duplicate: boolean
    incident: { id: string } | null
    task: { id: string } | null
  }>
  proposeCustomerOrderCancellation?(input: Record<string, unknown>): Promise<{
    duplicate: boolean
    incident: { id: string } | null
    task: { id: string } | null
  }>
  proposeCustomerAddressChange?(input: Record<string, unknown>): Promise<{
    duplicate: boolean
    incident: { id: string } | null
    task: { id: string } | null
  }>
  searchGovernedKnowledge(input: KnowledgeSearchInput): Promise<KnowledgeSearchOutput>
}

export type CustomerSupportNativeToolContext = {
  container: MedusaContainer
  conversation_id: string
  customer_message_context?: string[]
  customer_id: string | null
  inbound_message_id: string
  locale: "en" | "vi"
  service: CustomerSupportNativeToolService
  tenant_id: string
}

function normalizeLocationEvidence(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/giu, "d")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

export type CustomerDraftCartPurchaseContext = {
  region_id: string
  sales_channel_id: string
}

/**
 * The model receives this server-resolved context with its invocation. It must
 * never guess a region or sales channel from customer text.
 */
export async function resolveCustomerDraftCartPurchaseContext(
  container: MedusaContainer,
  locale: "en" | "vi"
): Promise<CustomerDraftCartPurchaseContext | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [regionResult, salesChannelResult] = await Promise.all([
    query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      pagination: { skip: 0, take: 20 },
    }),
    query.graph({
      entity: "sales_channel",
      fields: ["id"],
      pagination: { skip: 0, take: 2 },
    }),
  ])
  const regions = regionResult.data as Array<{
    currency_code?: string | null
    id: string
  }>
  const preferredCurrency = locale === "vi" ? "vnd" : "usd"
  const region =
    regions.find(
      (candidate) => candidate.currency_code?.toLocaleLowerCase() === preferredCurrency
    ) ?? regions[0]
  const salesChannel = salesChannelResult.data[0] as { id: string } | undefined
  if (!region || !salesChannel) return null
  return { region_id: region.id, sales_channel_id: salesChannel.id }
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
  let resolvedTravelLocation: TravelLocation | undefined
  let travelForecast: WeatherForecastOutput | undefined
  let travelClimate: WeatherClimateOutput | undefined
  let travelCatalog: CustomerCatalogSnapshot | undefined
  let travelOutfit: ReturnType<typeof composeTravelOutfit> | undefined

  return async function executeCustomerSupportNativeTool(
    call: ModelToolCall
  ): Promise<Record<string, unknown>> {
    if (
      !context.customer_id &&
      CUSTOMER_SUPPORT_VERIFIED_CUSTOMER_TOOL_NAMES.has(call.name)
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Customer order and proposal tools require a verified customer identity."
      )
    }

    if (call.name === "estimate_shipping_delivery") {
      const parsed = NativeShippingEstimateInput.parse(call.arguments)
      const destination = normalizeLocationEvidence(
        parsed.destination_location
      )
      const destinationWasSuppliedByCustomer = (
        context.customer_message_context ?? []
      ).some((message) => normalizeLocationEvidence(message).includes(destination))
      if (!destinationWasSuppliedByCustomer) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Shipping estimates require a destination stated by the customer in the current conversation."
        )
      }
      const result = await executeShippingEstimate(
        {
          destination_location: parsed.destination_location,
          weight: parsed.weight ?? 150,
        },
        "customer-support-agent"
      )
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: result.input,
        output: result.output,
        tool_name: SHIPPING_ESTIMATE_TOOL.name,
        tool_version: SHIPPING_ESTIMATE_TOOL.version,
      })
      return result.output
    }

    if (call.name === "search_catalog") {
      const parsed = NativeCatalogSearchInput.parse(call.arguments)
      let result = await executeCatalogRead(
        context.container,
        { limit: 8, locale: context.locale, query: parsed.query },
        { tenant_id: context.tenant_id }
      )
      if (result.output.total_count === 0) {
        result = await executeCatalogRead(
          context.container,
          { limit: 8, locale: context.locale },
          { tenant_id: context.tenant_id }
        )
      }
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

    if (call.name === "resolve_travel_location") {
      const parsed = TravelLocationResolveInput.parse({ ...call.arguments, locale: context.locale })
      const destination = normalizeLocationEvidence(parsed.query)
      const suppliedByCustomer = (context.customer_message_context ?? []).some((message) =>
        normalizeLocationEvidence(message).includes(destination)
      )
      if (!suppliedByCustomer) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Travel location lookup requires a destination stated by the customer in the current conversation."
        )
      }
      const output = await resolveTravelLocation(parsed)
      resolvedTravelLocation = output.candidates.length === 1 ? output.candidates[0] : undefined
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: parsed,
        output: { ambiguous: output.ambiguous, candidate_count: output.candidates.length, source: output.source, status: output.status },
        tool_name: TRAVEL_LOCATION_RESOLVE_TOOL.name,
        tool_version: TRAVEL_LOCATION_RESOLVE_TOOL.version,
      })
      return output
    }

    if (call.name === "get_weather_forecast") {
      const parsed = WeatherForecastInput.parse(call.arguments)
      if (!resolvedTravelLocation) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Resolve one unambiguous customer destination before reading a forecast.")
      }
      const output = await getTravelWeatherForecast({ ...parsed, location: resolvedTravelLocation })
      travelForecast = output
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: parsed,
        output: { evidence_kind: output.evidence_kind, source: output.source, status: output.status, weather_day_count: output.weather_days.length },
        tool_name: WEATHER_FORECAST_TOOL.name,
        tool_version: WEATHER_FORECAST_TOOL.version,
      })
      return output
    }

    if (call.name === "get_climate_normals") {
      const parsed = WeatherClimateInput.parse(call.arguments)
      if (!resolvedTravelLocation) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Resolve one unambiguous customer destination before reading climate history.")
      }
      const output = await getTravelClimateNormals({ ...parsed, location: resolvedTravelLocation })
      travelClimate = output
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: parsed,
        output: { evidence_kind: output.evidence_kind, sample_years: output.sample_years, source: output.source },
        tool_name: WEATHER_CLIMATE_TOOL.name,
        tool_version: WEATHER_CLIMATE_TOOL.version,
      })
      return output
    }

    if (call.name === "search_catalog_by_attributes") {
      const parsed = CatalogAttributeSearchInput.parse(call.arguments)
      let result = await executeCatalogRead(
        context.container,
        { limit: 8, locale: context.locale, query: parsed.query },
        { tenant_id: context.tenant_id }
      )
      if (!result.output.products.length) {
        result = await executeCatalogRead(
          context.container,
          { limit: 8, locale: context.locale },
          { tenant_id: context.tenant_id }
        )
      }
      travelCatalog = filterCatalogByTravelAttributes(result.output, parsed)
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: parsed,
        output: { product_ids: travelCatalog.status === "READY" ? travelCatalog.products.map((product) => product.id) : [], total_count: travelCatalog.total_count },
        tool_name: CATALOG_ATTRIBUTE_SEARCH_TOOL.name,
        tool_version: CATALOG_ATTRIBUTE_SEARCH_TOOL.version,
      })
      return travelCatalog
    }

    if (call.name === "compose_travel_outfit") {
      const parsed = OutfitComposeInput.parse(call.arguments)
      if (!travelCatalog) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Search the live catalog by travel attributes before composing an outfit.")
      travelOutfit = composeTravelOutfit(travelCatalog, parsed)
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: parsed,
        output: travelOutfit,
        tool_name: OUTFIT_COMPOSE_TOOL.name,
        tool_version: OUTFIT_COMPOSE_TOOL.version,
      })
      return travelOutfit
    }

    if (call.name === "build_travel_packing_checklist") {
      const parsed = TravelPackingChecklistInput.parse(call.arguments)
      const output = buildTravelPackingChecklist({
        catalog: travelCatalog,
        climate: travelClimate,
        forecast: travelForecast,
        outfit: travelOutfit,
        trip_days: parsed.trip_days,
      })
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: parsed,
        output: { buy_product_ids: output.buy_from_store.flatMap((item) => item.product_id ? [item.product_id] : []), evidence_kind: output.evidence_kind },
        tool_name: TRAVEL_PACKING_CHECKLIST_TOOL.name,
        tool_version: TRAVEL_PACKING_CHECKLIST_TOOL.version,
      })
      return output
    }

    if (call.name === "check_realtime_stock") {
      const parsed = NativeRealtimeStockInput.parse(call.arguments)
      const result = await executeCatalogRealtimeStockCheck(
        context.container,
        parsed
      )
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: result.input,
        output: {
          product_id: result.output.product_id,
          requested_quantity: result.output.requested_quantity,
          status: result.output.status,
          variants: result.output.variants.map((variant) => ({
            availability: variant.availability,
            available_quantity: variant.available_quantity,
            id: variant.id,
          })),
        },
        tool_name: CATALOG_REALTIME_STOCK_TOOL.name,
        tool_version: CATALOG_REALTIME_STOCK_TOOL.version,
      })
      return result.output
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

    if (call.name === "search_orders") {
      const parsed = NativeOrderSearchInput.parse(call.arguments)
      const searchResult = await executeOrderSearch(
        context.container,
        {
          customer_id: context.customer_id ?? undefined,
          email: parsed.email,
          limit: 5,
          phone: parsed.phone,
          query: parsed.query,
        },
        "customer-support-agent"
      )
      const output = searchResult.output
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: searchResult.input,
        output: {
          order_count: output.orders.length,
          order_ids: output.orders.map((o) => o.order_id),
          total_count: output.total_count,
        },
        tool_name: ORDER_SEARCH_TOOL.name,
        tool_version: ORDER_SEARCH_TOOL.version,
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

    if (call.name === "check_delivery_status") {
      const parsed = NativeDeliveryStatusInput.parse(call.arguments)
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
          tool_name: FULFILLMENT_READ_TOOL.name,
          tool_version: FULFILLMENT_READ_TOOL.version,
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
          tool_name: FULFILLMENT_READ_TOOL.name,
          tool_version: FULFILLMENT_READ_TOOL.version,
        })
        return output
      }
      const [order, fulfillment] = await Promise.all([
        executeOrderRead(
          context.container,
          { order_id: data[0].id },
          "customer-support-agent"
        ),
        executeFulfillmentRead(
          context.container,
          { order_id: data[0].id },
          "customer-support-agent"
        ),
      ])
      const output = {
        display_id: parsed.order_code,
        fulfillment: fulfillment.output,
        order: order.output,
        status: "FOUND",
      }
      await context.service.recordCustomerReadToolCall({
        conversation_id: context.conversation_id,
        inbound_message_id: context.inbound_message_id,
        input: fulfillment.input,
        output: fulfillment.output,
        tool_name: FULFILLMENT_READ_TOOL.name,
        tool_version: FULFILLMENT_READ_TOOL.version,
      })
      return output
    }

    if (call.name === "propose_draft_cart") {
      const parsed = NativeDraftCartProposalInput.parse(call.arguments)
      if (
        parsed.conversation_id !== context.conversation_id ||
        parsed.customer_confirmation_message_id !== context.inbound_message_id
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Draft cart proposals must use the current conversation and inbound confirmation."
        )
      }
      const proposal = await context.service.proposeCustomerDraftCart(parsed)
      return {
        approval_id: proposal.approval?.id ?? null,
        duplicate: proposal.duplicate,
        incident_id: proposal.incident?.id ?? null,
        outcome: "PENDING_MANAGER_APPROVAL",
        recommendation_id: proposal.recommendation?.id ?? null,
      }
    }

    if (call.name === "propose_return_review") {
      const parsed = NativeReturnProposalInput.parse(call.arguments)
      if (
        parsed.conversation_id !== context.conversation_id ||
        parsed.customer_confirmation_message_id !== context.inbound_message_id
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Return proposals must use the current conversation and inbound customer request."
        )
      }
      const proposal = await context.service.proposeCustomerReturnReview(parsed)
      return {
        duplicate: proposal.duplicate,
        incident_id: proposal.incident?.id ?? null,
        outcome: "PENDING_HUMAN_REVIEW",
        task_id: proposal.task?.id ?? null,
      }
    }

    if (call.name === "propose_order_cancellation") {
      const parsed = NativeOrderCancelProposalInput.parse(call.arguments)
      if (
        parsed.conversation_id !== context.conversation_id ||
        parsed.customer_confirmation_message_id !== context.inbound_message_id
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Cancellation proposals must use the current conversation and inbound customer request."
        )
      }
      if (!context.service.proposeCustomerOrderCancellation) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Order cancellation is not supported."
        )
      }
      const proposal = await context.service.proposeCustomerOrderCancellation(parsed)
      return {
        duplicate: proposal.duplicate,
        incident_id: proposal.incident?.id ?? null,
        outcome: "PENDING_HUMAN_REVIEW",
        task_id: proposal.task?.id ?? null,
      }
    }

    if (call.name === "propose_address_change") {
      const parsed = NativeOrderUpdateAddressProposalInput.parse(call.arguments)
      if (
        parsed.conversation_id !== context.conversation_id ||
        parsed.customer_confirmation_message_id !== context.inbound_message_id
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Address change proposals must use the current conversation and inbound customer request."
        )
      }
      if (!context.service.proposeCustomerAddressChange) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Address change is not supported."
        )
      }
      const proposal = await context.service.proposeCustomerAddressChange(parsed)
      return {
        duplicate: proposal.duplicate,
        incident_id: proposal.incident?.id ?? null,
        outcome: "PENDING_HUMAN_REVIEW",
        task_id: proposal.task?.id ?? null,
      }
    }

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Customer support tool ${call.name} is not available.`
    )
  }
}
