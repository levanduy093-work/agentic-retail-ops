import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"

type OrderPlacedEventData = {
  id: string
}

type OrderForFulfillment = {
  fulfillments?: Array<{
    provider_id?: string | null
  }>
  id: string
  items?: Array<{
    id: string
    quantity: number
  }>
  shipping_methods?: Array<{
    shipping_option?: {
      provider_id?: string | null
    } | null
  }>
}

export default async function createGhnFulfillmentOnOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<OrderPlacedEventData>) {
  if (process.env.GHN_AUTO_FULFILL_ON_ORDER_PLACED === "false") {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "items.id",
      "items.quantity",
      "shipping_methods.shipping_option.provider_id",
      "fulfillments.provider_id",
    ],
    filters: { id: data.id },
  })
  const order = (orders as OrderForFulfillment[])[0]

  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cannot create GHN fulfillment: order ${data.id} was not found`
    )
  }

  const usesGhn = order.shipping_methods?.some(
    (method) => method.shipping_option?.provider_id === "ghn_ghn"
  )
  const hasGhnFulfillment = order.fulfillments?.some(
    (fulfillment) => fulfillment.provider_id === "ghn_ghn"
  )

  if (!usesGhn || hasGhnFulfillment || !order.items?.length) {
    return
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
    pagination: { skip: 0, take: 1 },
  })
  const location = locations[0]

  if (!location) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cannot create GHN fulfillment: no stock location is configured"
    )
  }

  await createOrderFulfillmentWorkflow(container).run({
    input: {
      order_id: order.id,
      location_id: location.id,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
      })),
      labels: [],
    },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
