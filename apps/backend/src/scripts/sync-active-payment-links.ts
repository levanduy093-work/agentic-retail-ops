import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PAYMENT_HUB_MODULE } from "../modules/payment-hub"
import PaymentHubModuleService from "../modules/payment-hub/service"

export default async function syncActivePaymentLinks({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const paymentHub = container.resolve(PAYMENT_HUB_MODULE) as PaymentHubModuleService

  logger.info("Syncing payment provider links to regions based on active gateway...")

  const [sepayConn] = (await paymentHub.listPaymentProviderConnections({
    code: "SEPAY",
  })) as any[]
  const [payosConn] = (await paymentHub.listPaymentProviderConnections({
    code: "PAYOS",
  })) as any[]

  const sepayActive = Boolean(sepayConn?.is_enabled)
  const payosActive = Boolean(payosConn?.is_enabled)

  logger.info(`Status - SePay Active: ${sepayActive}, PayOS Active: ${payosActive}`)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "payment_providers.*"],
  })

  for (const region of regions) {
    const hasSepay = (region as any).payment_providers?.some(
      (p: any) => p.id === "pp_sepay_sepay"
    )
    const hasPayos = (region as any).payment_providers?.some(
      (p: any) => p.id === "pp_payos_payos"
    )

    if (sepayActive) {
      if (!hasSepay) {
        logger.info(`Linking pp_sepay_sepay to region ${region.id}`)
        await link.create({
          [Modules.REGION]: { region_id: region.id },
          [Modules.PAYMENT]: { payment_provider_id: "pp_sepay_sepay" },
        })
      }
      if (hasPayos) {
        logger.info(`Unlinking pp_payos_payos from region ${region.id}`)
        await link.dismiss({
          [Modules.REGION]: { region_id: region.id },
          [Modules.PAYMENT]: { payment_provider_id: "pp_payos_payos" },
        })
      }
    } else if (payosActive) {
      if (!hasPayos) {
        logger.info(`Linking pp_payos_payos to region ${region.id}`)
        await link.create({
          [Modules.REGION]: { region_id: region.id },
          [Modules.PAYMENT]: { payment_provider_id: "pp_payos_payos" },
        })
      }
      if (hasSepay) {
        logger.info(`Unlinking pp_sepay_sepay from region ${region.id}`)
        await link.dismiss({
          [Modules.REGION]: { region_id: region.id },
          [Modules.PAYMENT]: { payment_provider_id: "pp_sepay_sepay" },
        })
      }
    }
  }

  logger.info("Sync completed successfully!")
}
