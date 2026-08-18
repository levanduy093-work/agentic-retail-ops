import {
  validateAndTransformBody,
  type MiddlewareRoute,
} from "@medusajs/framework/http"
import {
  ConfigurePayosProvider,
  TestPayosProvider,
} from "./validators"

export const paymentHubMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/payments/providers",
    method: "POST",
    middlewares: [validateAndTransformBody(ConfigurePayosProvider)],
  },
  {
    matcher: "/admin/payments/providers/verify",
    method: "POST",
    middlewares: [validateAndTransformBody(TestPayosProvider)],
  },
]
