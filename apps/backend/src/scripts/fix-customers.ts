import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function auditCustomerAccounts({
  container,
}: {
  container: MedusaContainer
}) {
  const customerService = container.resolve(Modules.CUSTOMER)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const customers = await customerService.listCustomers(
    { has_account: true },
    { take: 1000 }
  )

  if (customers.length === 0) {
    logger.info("No customers found with has_account = true.")
    return
  }

  logger.warn(
    `Found ${customers.length} customer account(s): ${customers
      .map((customer) => customer.id)
      .join(", ")}`
  )
  logger.warn(
    "Medusa 2.18 treats has_account as account lifecycle state and does not allow updating it directly. No customer records were changed."
  )
}
