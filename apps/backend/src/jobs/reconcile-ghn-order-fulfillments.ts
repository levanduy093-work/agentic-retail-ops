import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ensureGhnOrderFulfillmentWorkflow } from "../workflows/shipping-hub/ensure-ghn-order-fulfillment"

const BATCH_SIZE = 100

export default async function reconcileGhnOrderFulfillmentsJob(
  container: MedusaContainer
) {
  if (process.env.GHN_AUTO_FULFILL_ON_ORDER_PLACED === "false") {
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const candidates = await orders.listOrders(
    {},
    {
      order: { created_at: "DESC" },
      select: ["id"],
      take: BATCH_SIZE,
    }
  )

  let created = 0
  let failed = 0
  for (const order of candidates) {
    try {
      const { result } = await ensureGhnOrderFulfillmentWorkflow(container).run({
        input: { order_id: order.id },
      })
      if (result.created) {
        created += 1
      }
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`GHN fulfillment recovery failed for ${order.id}: ${message}`)
    }
  }

  if (created || failed) {
    logger.info(
      `GHN fulfillment reconciliation completed: ${created} created, ${failed} failed.`
    )
  }
}

export const config = {
  name: "reconcile-ghn-order-fulfillments",
  schedule: "* * * * *",
}
