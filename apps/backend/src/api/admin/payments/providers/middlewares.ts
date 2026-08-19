import {
  validateAndTransformBody,
  type MiddlewareRoute,
} from "@medusajs/framework/http"
import {
  ConfigurePaymentProvider,
  TestPaymentProvider,
} from "./validators"

export const paymentHubMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/payments/providers",
    method: "POST",
    middlewares: [validateAndTransformBody(ConfigurePaymentProvider)],
  },
  {
    matcher: "/admin/payments/providers/verify",
    method: "POST",
    middlewares: [validateAndTransformBody(TestPaymentProvider)],
  },
]
