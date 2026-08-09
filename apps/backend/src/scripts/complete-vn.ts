import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createTaxRegionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function completeVietnamData({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  logger.info("Ensuring the Vietnam tax region exists...")
  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })

  const vietnamTaxRegion = taxRegions.find(
    (taxRegion) => taxRegion.country_code === "vn"
  )

  if (!vietnamTaxRegion) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "vn" }],
    })
    logger.info("Created the Vietnam tax region.")
  } else {
    logger.info(`Vietnam tax region already exists: ${vietnamTaxRegion.id}`)
  }

  logger.info("Updating Shipping Options & Fulfillment Sets...")
  const { data: fulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name"],
  })

  for (const fSet of fulfillmentSets) {
    if (fSet.name.includes("European Warehouse")) {
      await fulfillmentModuleService.updateFulfillmentSets({
        id: fSet.id,
        name: "Giao hàng từ kho Việt Nam",
      })
    }
  }

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })

  for (const option of shippingOptions) {
    let newName = option.name
    if (option.name === "Standard Shipping") newName = "Giao hàng tiêu chuẩn"
    if (option.name === "Express Shipping") newName = "Giao hàng hỏa tốc"

    if (newName !== option.name) {
      await updateShippingOptionsWorkflow(container).run({
        input: [{ id: option.id, name: newName }],
      })
    }
  }

  logger.info("Successfully completed Vietnam data update!")
}
