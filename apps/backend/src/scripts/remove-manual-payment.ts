import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function removeManualPaymentFromRegions({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("Removing pp_system_default from regions...")

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "payment_providers.*"],
  })

  for (const region of regions) {
    const hasManual = (region as any).payment_providers?.some(
      (p: any) => p.id === "pp_system_default"
    )

    if (hasManual) {
      logger.info(`Unlinking pp_system_default from region ${region.name} (${region.id})...`)
      await link.dismiss({
        [Modules.REGION]: {
          region_id: region.id,
        },
        [Modules.PAYMENT]: {
          payment_provider_id: "pp_system_default",
        },
      })
      logger.info(`Dismissed pp_system_default from region ${region.id} successfully!`)
    }
  }

  const { data: updatedRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "payment_providers.*"],
  })

  logger.info(`Updated regions payment providers: ${JSON.stringify(updatedRegions, null, 2)}`)
}
