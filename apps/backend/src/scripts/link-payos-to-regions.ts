import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function linkPayosToRegions({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("Checking regions and payment providers...")

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "payment_providers.*"],
  })

  logger.info(`Found ${regions.length} regions: ${JSON.stringify(regions, null, 2)}`)

  for (const region of regions) {
    const hasPayos = (region as any).payment_providers?.some(
      (p: any) => p.id === "pp_payos_payos"
    )

    if (!hasPayos) {
      logger.info(`Linking pp_payos_payos to region ${region.name} (${region.id})...`)
      await link.create({
        [Modules.REGION]: {
          region_id: region.id,
        },
        [Modules.PAYMENT]: {
          payment_provider_id: "pp_payos_payos",
        },
      })
      logger.info(`Linked pp_payos_payos to region ${region.id} successfully!`)
    } else {
      logger.info(`Region ${region.name} already has pp_payos_payos`)
    }
  }
}
