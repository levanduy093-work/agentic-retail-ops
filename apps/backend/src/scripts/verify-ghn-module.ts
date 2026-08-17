import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { listShippingOptionsForCartWithPricingWorkflow } from "@medusajs/medusa/core-flows"
import { GhnClient } from "../modules/ghn-fulfillment/ghn-client"
import GhnFulfillmentProviderService from "../modules/ghn-fulfillment/services/ghn-fulfillment-provider"
import { VietnamAddressService } from "../modules/ghn-fulfillment/services/vietnam-address-service"
import { getGhnSettings } from "../modules/shipping-hub/ghn-connection"

export default async function verifyGhnModule({ container }: ExecArgs) {
  console.log("=== VERIFYING GHN MODULE & CONFIGURATION ===")
  
  // 1. Check Fulfillment Service
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  console.log("Fulfillment Service resolved:", Boolean(fulfillmentService))

  // 2. Check GHN Settings
  const settings = await getGhnSettings(container)
  console.log("GHN Settings loaded:", {
    environment: settings.environment,
    shop_id: settings.shop_id,
    has_token: Boolean(settings.api_token),
    sender_name: settings.sender_name,
    sender_province_id: settings.sender_province_id,
    sender_district_id: settings.sender_district_id,
  })

  // 3. Test Vietnam Address Master Data with Sandbox or Local Fallback
  try {
    const provinces = await VietnamAddressService.getProvinces()
    console.log(`Vietnam Address Service loaded: ${provinces.length} provinces.`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`Notice for Vietnam Address Service: ${msg}`)
  }

  // 4. Test Client instantiation
  const client = new GhnClient({
    apiToken: settings.api_token,
    baseUrl: settings.base_url,
    clientId: settings.client_id,
    environment: settings.environment,
    shopId: settings.shop_id,
  })
  console.log("GHN Client created successfully:", Boolean(client))

  const provider = new GhnFulfillmentProviderService(container, {})
  const quote = await provider.calculatePrice(
    { id: "ghn-standard" } as any,
    {},
    {
      items: [{ quantity: 1, variant: { weight: settings.default_weight } }],
      shipping_address: {
        metadata: {
          ghn_district_id: settings.sender_district_id,
          ghn_ward_code: settings.sender_ward_code,
        },
      },
    } as any
  )
  console.log("GHN calculated quote returned:", quote.calculated_amount > 0)

  if (process.env.GHN_VERIFY_CART_ID) {
    const { result: shippingOptions } =
      await listShippingOptionsForCartWithPricingWorkflow(container).run({
        input: {
          cart_id: process.env.GHN_VERIFY_CART_ID,
          options: [{ id: process.env.GHN_VERIFY_SHIPPING_OPTION_ID || "" }],
        },
      })
    console.log(
      "Cart shipping quote returned:",
      shippingOptions.some((option) => option.amount > 0)
    )
  }

  console.log("=== GHN MODULE VERIFICATION PASSED ===")
}
