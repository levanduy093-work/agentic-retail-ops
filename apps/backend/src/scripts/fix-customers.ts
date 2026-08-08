import { ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function ({ container }: { container: any }) {
  const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
  
  const customers = await customerService.listCustomers({
    has_account: true
  }, { take: 1000 })
  
  if (customers.length > 0) {
    for (const customer of customers) {
      await customerService.updateCustomers(customer.id, { has_account: false })
    }
    console.log("Updated customers to has_account = false: " + customers.map(c => c.id).join(", "))
  } else {
    console.log("No customers found with has_account = true.")
  }
}
