import type {
  ILockingModule,
  IInventoryService,
  IOrderModuleService,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createOrderFulfillmentWorkflow,
  createReservationsWorkflow,
  updateReservationsWorkflow,
} from "@medusajs/medusa/core-flows"

type OrderForGhnFulfillment = {
  canceled_at?: Date | null
  fulfillments?: Array<{
    id: string
    provider_id?: string | null
  } | undefined>
  id: string
  items?: Array<{
    id: string
    quantity: number
    variant_id?: string | null
  }>
  shipping_methods?: Array<{
    data?: Record<string, unknown> | null
    shipping_option_id?: string | null
  }>
}

type ShippingOptionForFulfillment = {
  id: string
  provider_id?: string | null
  service_zone?: {
    fulfillment_set?: {
      location?: {
        id: string
      } | null
    } | null
  } | null
}

type VariantInventoryLink = {
  inventory_item_id: string
  required_quantity: number
}

type VariantWithInventory = {
  id: string
  manage_inventory?: boolean
  inventory_items?: VariantInventoryLink[]
}

export type ExistingReservation = {
  id: string
  inventory_item_id: string
  line_item_id?: string | null
  location_id: string
  quantity: number
}

export type ReservationToCreate = {
  inventory_item_id: string
  line_item_id: string
  location_id: string
  quantity: number
}

export type ReservationToUpdate = {
  id: string
  location_id: string
  quantity: number
}

type ReservableOrderItem = {
  id: string
  quantity: number
  variant_id?: string | null
}

export type EnsureGhnOrderFulfillmentInput = {
  order_id: string
}

export type EnsureGhnOrderFulfillmentResult = {
  created: boolean
  fulfillment_id?: string
  order_id: string
  reason?: "canceled" | "not_ghn" | "already_created" | "no_items"
}

const GHN_PROVIDER_ID = "ghn_ghn"

export function buildReservationPlan({
  existingReservations,
  locationId,
  orderItems,
  variants,
}: {
  existingReservations: ExistingReservation[]
  locationId: string
  orderItems: ReservableOrderItem[]
  variants: VariantWithInventory[]
}): {
  creates: ReservationToCreate[]
  updates: ReservationToUpdate[]
} {
  const variantsById = new Map(
    variants.map((variant) => [variant.id, variant])
  )

  const creates: ReservationToCreate[] = []
  const updates: ReservationToUpdate[] = []

  for (const item of orderItems) {
    if (!item.variant_id) {
      continue
    }

    const variant = variantsById.get(item.variant_id)
    if (!variant?.manage_inventory) {
      continue
    }

    if (!variant.inventory_items?.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cannot reserve ${item.id}: its managed variant has no inventory item.`
      )
    }

    for (const inventoryItem of variant.inventory_items) {
      const matchingReservations = existingReservations.filter(
        (reservation) =>
          reservation.line_item_id === item.id &&
          reservation.inventory_item_id === inventoryItem.inventory_item_id
      )
      const requiredQuantity =
        Number(item.quantity) * Number(inventoryItem.required_quantity)

      if (matchingReservations.length > 1) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Cannot fulfill ${item.id}: multiple inventory reservations were found.`
        )
      }

      const existing = matchingReservations[0]
      if (!existing) {
        creates.push({
          inventory_item_id: inventoryItem.inventory_item_id,
          line_item_id: item.id,
          location_id: locationId,
          quantity: requiredQuantity,
        })
        continue
      }

      if (
        Number(existing.quantity) < requiredQuantity ||
        existing.location_id !== locationId
      ) {
        updates.push({
          id: existing.id,
          location_id: locationId,
          quantity: Math.max(Number(existing.quantity), requiredQuantity),
        })
      }
    }
  }

  return { creates, updates }
}

const ensureGhnOrderFulfillmentStep = createStep<
  EnsureGhnOrderFulfillmentInput,
  EnsureGhnOrderFulfillmentResult,
  void
>(
  "ensure-ghn-order-fulfillment",
  async (input, { container }) => {
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    const result = await locking.execute<EnsureGhnOrderFulfillmentResult>(
      `shipping-hub:ghn-fulfillment:${input.order_id}`,
      async () => {
        const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
        const typedOrder = await orders.retrieveOrder(input.order_id, {
          relations: ["items", "shipping_methods", "fulfillments"],
        }) as OrderForGhnFulfillment

        if (!typedOrder) {
          throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            `Cannot create GHN fulfillment: order ${input.order_id} was not found`
          )
        }

        if (typedOrder.canceled_at) {
          return {
            created: false,
            order_id: typedOrder.id,
            reason: "canceled",
          }
        }

        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const shippingOptionIds = typedOrder.shipping_methods
          ?.map((method) => method.shipping_option_id)
          .filter((id): id is string => Boolean(id)) ?? []
        const { data: shippingOptions } = shippingOptionIds.length
          ? await query.graph({
              entity: "shipping_option",
              fields: [
                "id",
                "provider_id",
                "service_zone.fulfillment_set.location.id",
              ],
              filters: { id: shippingOptionIds },
            })
          : { data: [] }
        const ghnShippingOption = (
          shippingOptions as ShippingOptionForFulfillment[]
        ).find(
          (option) => option.provider_id === GHN_PROVIDER_ID
        )
        if (!ghnShippingOption) {
          return {
            created: false,
            order_id: typedOrder.id,
            reason: "not_ghn",
          }
        }

        const { data: orderFulfillments } = await query.graph({
          entity: "order",
          fields: ["fulfillments.id", "fulfillments.provider_id"],
          filters: { id: input.order_id }
        })
        const fulfillments = (orderFulfillments[0]?.fulfillments ?? []) as Array<
          { id: string; provider_id?: string | null } | null | undefined
        >
        const existing = fulfillments.find(
          (fulfillment) => fulfillment?.provider_id === GHN_PROVIDER_ID
        )
        if (existing) {
          return {
            created: false,
            fulfillment_id: existing?.id,
            order_id: typedOrder.id,
            reason: "already_created",
          }
        }

        const orderItems = typedOrder.items ?? []
        if (!orderItems.length) {
          return {
            created: false,
            order_id: typedOrder.id,
            reason: "no_items",
          }
        }

        let location: { id: string } | null | undefined =
          ghnShippingOption.service_zone?.fulfillment_set?.location ?? null

        if (!location) {
          const { data: locations } = await query.graph({
            entity: "stock_location",
            fields: ["id"],
            pagination: { skip: 0, take: 1 },
          })
          location = locations[0] as { id: string } | undefined
        }

        if (!location) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Cannot create GHN fulfillment: no stock location is configured"
          )
        }

        const { data: variants } = await query.graph({
          entity: "product_variant",
          fields: [
            "id",
            "manage_inventory",
            "inventory_items.inventory_item_id",
            "inventory_items.required_quantity",
          ],
          filters: {
            id: orderItems
              .map((item) => item.variant_id)
              .filter((id): id is string => Boolean(id)),
          },
        })
        const inventory = container.resolve<IInventoryService>(Modules.INVENTORY)
        const existingReservations = await inventory.listReservationItems({
          line_item_id: orderItems.map((item) => item.id),
        })
        const reservationPlan = buildReservationPlan({
          existingReservations: existingReservations.map((reservation) => ({
            id: reservation.id,
            inventory_item_id: reservation.inventory_item_id,
            line_item_id: reservation.line_item_id,
            location_id: reservation.location_id,
            quantity: Number(reservation.quantity),
          })),
          locationId: location.id,
          orderItems,
          variants: variants as VariantWithInventory[],
        })
        if (reservationPlan.updates.length) {
          await updateReservationsWorkflow(container).run({
            input: { updates: reservationPlan.updates },
          })
        }
        if (reservationPlan.creates.length) {
          await createReservationsWorkflow(container).run({
            input: { reservations: reservationPlan.creates },
          })
        }

        const { result: fulfillment } = await createOrderFulfillmentWorkflow(
          container
        ).run({
          input: {
            items: orderItems.map((item) => ({
              id: item.id,
              quantity: item.quantity,
            })),
            labels: [],
            location_id: location.id,
            order_id: typedOrder.id,
          },
        })

        return {
          created: true,
          fulfillment_id: fulfillment.id,
          order_id: typedOrder.id,
        }
      },
      { timeout: 60 }
    )

    return new StepResponse(result)
  }
)

export const ensureGhnOrderFulfillmentWorkflow = createWorkflow(
  "ensure-ghn-order-fulfillment",
  function (input: EnsureGhnOrderFulfillmentInput) {
    const result = ensureGhnOrderFulfillmentStep(input)
    return new WorkflowResponse(result)
  }
)
