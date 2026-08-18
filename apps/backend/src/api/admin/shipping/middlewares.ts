import {
  validateAndTransformBody,
  type MiddlewareRoute,
} from "@medusajs/framework/http"
import {
  ConfigureGhnCarrier,
  ConfigurePackagingProfile,
  TestGhnCarrier,
} from "./validators"

export const shippingHubMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/shipping/packaging-profile",
    method: "POST",
    middlewares: [validateAndTransformBody(ConfigurePackagingProfile)],
  },
  {
    matcher: "/admin/shipping/carriers/ghn",
    method: "POST",
    middlewares: [validateAndTransformBody(ConfigureGhnCarrier)],
  },
  {
    matcher: "/admin/shipping/carriers/ghn/test",
    method: "POST",
    middlewares: [validateAndTransformBody(TestGhnCarrier)],
  },
]
