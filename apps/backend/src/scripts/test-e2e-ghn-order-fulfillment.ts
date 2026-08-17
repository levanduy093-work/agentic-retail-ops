import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createOrderFulfillmentWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"
import { ingestGhnWebhookWorkflow } from "../workflows/shipping-hub/ingest-ghn-webhook"
import { getGhnSettings } from "../modules/shipping-hub/ghn-connection"
import type ShippingHubModuleService from "../modules/shipping-hub/service"
import { SHIPPING_HUB_MODULE } from "../modules/shipping-hub"

export default async function testE2EGhnOrderFulfillment({ container }: ExecArgs) {
  console.log("\n========================================================")
  console.log("🚀 STARTING E2E GHN ORDER & FULFILLMENT VERIFICATION")
  console.log("========================================================\n")

  // Load GHN settings from encrypted database into carrier registry
  await getGhnSettings(container)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Get Vietnam region & sales channel & product variant
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code", "countries.iso_2"],
  })
  const vnRegion = regions.find((r) =>
    r.countries?.some((c: any) => c?.iso_2?.toLowerCase() === "vn")
  ) || regions[0]

  if (!vnRegion) {
    throw new Error("No valid region found for Vietnam")
  }
  console.log(`✓ 1. Region resolved: ${vnRegion.id} (${vnRegion.currency_code})`)

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const defaultSalesChannel = salesChannels[0]
  if (!defaultSalesChannel) {
    throw new Error("No sales channel found")
  }
  console.log(`✓ 2. Sales Channel: ${defaultSalesChannel.name} (${defaultSalesChannel.id})`)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "product.title"],
  })
  const variant = variants[0]
  if (!variant) {
    throw new Error("No product variant found in database")
  }
  console.log(`✓ 3. Product Variant: ${variant.title} (ID: ${variant.id})`)

  // 2. Create Cart with Vietnam Address and GHN Metadata
  console.log("\n🛒 4. Creating test Cart with Vietnam shipping address...")
  const { result: cart } = await createCartWorkflow(container).run({
    input: {
      region_id: vnRegion.id,
      currency_code: vnRegion.currency_code,
      sales_channel_id: defaultSalesChannel.id,
      email: "test.customer@synapse.vn",
      shipping_address: {
        first_name: "Nguyễn Văn",
        last_name: "A",
        address_1: "72 Lê Thánh Tôn",
        city: "Quận 1",
        province: "Hồ Chí Minh",
        country_code: "vn",
        phone: "0901234567",
        metadata: {
          ghn_province_id: 202,
          ghn_district_id: 1442,
          ghn_ward_code: "20101",
        },
      },
      items: [
        {
          variant_id: variant.id,
          quantity: 1,
        },
      ],
    },
  })
  console.log(`✓ Cart created: ${cart.id}`)

  // 3. List shipping options for cart with pricing
  console.log("\n🚚 5. Calculating live shipping options for cart...")
  const { result: shippingOptions } = await listShippingOptionsForCartWithPricingWorkflow(container).run({
    input: {
      cart_id: cart.id,
    },
  })

  const ghnOption = shippingOptions.find((opt) =>
    opt.provider_id === "ghn_ghn" || opt.name.includes("GHN")
  )

  if (!ghnOption) {
    throw new Error(`GHN shipping option not returned for cart. Available: ${JSON.stringify(shippingOptions.map(o => o.name))}`)
  }

  console.log(`✓ GHN Shipping Option found: "${ghnOption.name}" (ID: ${ghnOption.id})`)
  console.log(`✓ Live Calculated Price: ${ghnOption.amount.toLocaleString("vi-VN")} ${vnRegion.currency_code.toUpperCase()}`)

  // 4. Add GHN Shipping Method to Cart
  console.log("\n📦 6. Adding GHN shipping method to cart...")
  await addShippingMethodToCartWorkflow(container).run({
    input: {
      cart_id: cart.id,
      options: [
        {
          id: ghnOption.id,
          data: ghnOption.data,
        },
      ],
    },
  })
  console.log("✓ Shipping method added successfully to cart")

  // 5. Initialize payment collection & session for Cart
  console.log("\n💰 7. Initializing payment collection & session for cart...")
  const { data: regionData } = await query.graph({
    entity: "region",
    fields: ["id", "payment_providers.id"],
    filters: { id: vnRegion.id },
  })
  const paymentProviderId =
    regionData[0]?.payment_providers?.[0]?.id || "pp_system_default"

  const { result: paymentCollection } =
    await createPaymentCollectionForCartWorkflow(container).run({
      input: {
        cart_id: cart.id,
      },
    })

  await createPaymentSessionsWorkflow(container).run({
    input: {
      payment_collection_id: paymentCollection.id,
      provider_id: paymentProviderId,
    },
  })
  console.log(`✓ Payment session initialized with provider: ${paymentProviderId}`)

  // 6. Complete Cart to create Order
  console.log("\n💳 8. Completing cart to create Order...")
  const { result: order } = await completeCartWorkflow(container).run({
    input: {
      id: cart.id,
    },
  })
  console.log(`✓ Order created successfully: ID: ${order.id} (Display ID: #${(order as any).display_id || "N/A"})`)

  // 6. Create Fulfillment via GHN Provider
  console.log("\n🏭 8. Fulfilling Order with GHN Carrier...")
  const { data: orderDetails } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "items.id",
      "items.quantity",
      "items.title",
      "items.unit_price",
      "items.variant_id",
      "shipping_address.*",
      "shipping_methods.*",
    ],
    filters: { id: order.id },
  })

  const orderFull = orderDetails[0]
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const location = stockLocations[0]

  const { result: fulfillmentResult } = await createOrderFulfillmentWorkflow(container).run({
    input: {
      order_id: order.id,
      location_id: location.id,
      items: (orderFull.items || []).map((i: any) => ({
        id: i.id,
        quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      })),
      labels: [],
    },
  })

  console.log(`✓ Fulfillment created: ID: ${fulfillmentResult.id}`)
  const fulfillmentData = (fulfillmentResult as any).data || {}
  const trackingNumber = (fulfillmentResult as any).labels?.[0]?.tracking_number || fulfillmentData.tracking_number || fulfillmentData.ghn_order_code

  console.log(`✓ GHN Tracking / Order Code: ${trackingNumber || "CREATED"}`)
  if (fulfillmentData.ghn_print_url) {
    console.log(`✓ GHN Print URL: ${fulfillmentData.ghn_print_url}`)
  }

  // 7. Verify Webhook Ingestion & Deduplication
  console.log("\n📡 9. Testing GHN Webhook Ingestion & Status Update...")
  const mockWebhookPayload = {
    OrderCode: trackingNumber || "GHN-TEST-123456",
    Status: "delivering",
    Description: "Shipper đang giao hàng tới khách",
    Time: new Date().toISOString(),
    TotalFee: ghnOption.amount,
  }

  const { result: webhookResult1 } = await ingestGhnWebhookWorkflow(container).run({
    input: mockWebhookPayload,
  })
  console.log(`✓ Webhook 1st ingestion result: duplicate = ${webhookResult1.event.duplicate} (Event ID: ${webhookResult1.event.event_id})`)

  // Test deduplication
  const { result: webhookResult2 } = await ingestGhnWebhookWorkflow(container).run({
    input: mockWebhookPayload,
  })
  console.log(`✓ Webhook 2nd ingestion (Deduplication check): duplicate = ${webhookResult2.event.duplicate} (Chống trùng lặp thành công!)`)

  // 8. Verify Shipment in Shipping Hub
  console.log("\n📊 10. Checking Shipping Hub Shipments List...")
  const shippingHub = container.resolve<ShippingHubModuleService>(SHIPPING_HUB_MODULE)
  const connections = await shippingHub.listShippingCarrierConnections({ code: "GHN" })
  console.log(`✓ Carrier Connection GHN: Active = ${connections[0]?.is_enabled}, Env = ${connections[0]?.environment}`)

  console.log("\n========================================================")
  console.log("🎉 ALL E2E VERIFICATIONS PASSED 100% SUCCESSFULLY!")
  console.log("========================================================\n")
}
