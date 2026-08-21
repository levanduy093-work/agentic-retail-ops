import { getOrderDetailWorkflow } from "@medusajs/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  OrderReadInput,
  OrderReadOutput,
  OrderSearchInput,
  OrderSearchOutput,
  toOrderReadOutput,
} from "./tools/order-tools"

export async function executeOrderRead(
  container: MedusaContainer,
  input: OrderReadInput,
  actorId: string
) {
  return executeAgentTool<OrderReadInput, OrderReadOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: actorId,
        granted_permissions: ["agent_order:read"],
        mode: "DIRECT",
      },
      input,
      tool_name: "order.read",
      tool_version: "1.0.0",
    },
    async ({ order_id }) => {
      const { result } = await getOrderDetailWorkflow(container).run({
        input: {
          fields: [
            "id",
            "canceled_at",
            "created_at",
            "currency_code",
            "customer_id",
            "display_id",
            "fulfillment_status",
            "fulfillments.id",
            "items.quantity",
            "payment_collections.id",
            "payment_status",
            "status",
            "total",
            "updated_at",
            "version",
          ],
          order_id,
        },
      })

      return toOrderReadOutput(result)
    }
  )
}

export async function executeOrderSearch(
  container: MedusaContainer,
  input: OrderSearchInput,
  actorId: string
) {
  return executeAgentTool<OrderSearchInput, OrderSearchOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: actorId,
        granted_permissions: ["agent_order:read"],
        mode: "DIRECT",
      },
      input,
      tool_name: "order.search",
      tool_version: "1.0.0",
    },
    async (parsed) => {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const filters: Record<string, unknown> = {}

      if (parsed.display_id) {
        filters.display_id = String(parsed.display_id)
      }
      if (parsed.customer_id) {
        filters.customer_id = parsed.customer_id
      }
      if (parsed.email) {
        filters.email = parsed.email
      }
      if (parsed.phone) {
        filters.shipping_address = {
          phone: parsed.phone,
        }
      }
      if (parsed.query) {
        filters.q = parsed.query
      }

      const { data: rawOrders, metadata } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "customer_id",
          "email",
          "currency_code",
          "total",
          "status",
          "fulfillment_status",
          "payment_status",
          "created_at",
          "canceled_at",
          "items.id",
          "items.product_title",
          "items.title",
          "items.variant_title",
          "items.quantity",
          "items.unit_price",
          "items.thumbnail",
          "shipping_address.first_name",
          "shipping_address.last_name",
          "shipping_address.phone",
          "shipping_address.address_1",
          "shipping_address.city",
          "shipping_address.province",
        ],
        filters,
        pagination: {
          order: { created_at: "DESC" },
          skip: 0,
          take: parsed.limit ?? 5,
        },
      })

      const orders = (rawOrders ?? []).map((raw: any) => ({
        canceled_at: raw.canceled_at
          ? new Date(raw.canceled_at).toISOString()
          : null,
        created_at: new Date(raw.created_at).toISOString(),
        currency_code: raw.currency_code ?? "vnd",
        customer_id: raw.customer_id ?? null,
        display_id: Number(raw.display_id),
        email: raw.email ?? null,
        fulfillment_status: raw.fulfillment_status ?? "not_fulfilled",
        items: (raw.items ?? []).map((item: any) => ({
          id: item.id,
          product_title: item.product_title ?? item.title ?? "Sản phẩm",
          quantity: Number(item.quantity) || 1,
          thumbnail: item.thumbnail ?? null,
          unit_price: Number(item.unit_price) || 0,
          variant_title: item.variant_title ?? null,
        })),
        order_id: raw.id,
        order_status: raw.status ?? "pending",
        payment_status: raw.payment_status ?? "not_paid",
        shipping_address: raw.shipping_address
          ? {
              address_1: raw.shipping_address.address_1 ?? null,
              city: raw.shipping_address.city ?? null,
              first_name: raw.shipping_address.first_name ?? null,
              last_name: raw.shipping_address.last_name ?? null,
              phone: raw.shipping_address.phone ?? null,
              province: raw.shipping_address.province ?? null,
            }
          : null,
        total: Number(raw.total) || 0,
      }))

      return {
        orders,
        total_count: metadata?.count ?? orders.length,
      }
    }
  )
}
