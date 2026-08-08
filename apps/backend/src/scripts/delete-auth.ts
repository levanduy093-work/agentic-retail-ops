import { IAuthModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function ({ container }: { container: any }) {
  const authModuleService: IAuthModuleService = container.resolve(Modules.AUTH)
  
  const authIdentities = await authModuleService.listAuthIdentities({}, { take: 1000 })
  
  const toDelete = authIdentities.filter((a: any) => {
    return 'customer_id' in (a.app_metadata || {})
  })
  
  if (toDelete.length > 0) {
    for (const identity of toDelete) {
      await authModuleService.deleteAuthIdentities([identity.id])
    }
    console.log("Deleted dangling auth identities: " + toDelete.map((a: any) => a.id).join(", "))
  } else {
    console.log("No auth identity found to delete.")
  }
}
