import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  auth: { type: "session" },
  baseUrl: window.location.origin,
  debug: false,
})
