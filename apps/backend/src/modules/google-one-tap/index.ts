import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import GoogleOneTapAuthService from './service'

export default ModuleProvider(Modules.AUTH, {
  services: [GoogleOneTapAuthService]
})
