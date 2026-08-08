import { authenticate, defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/customers/link-google",
      method: "POST",
      middlewares: [
        authenticate("customer", ["bearer"], { allowUnregistered: true })
      ]
    }
  ]
})
