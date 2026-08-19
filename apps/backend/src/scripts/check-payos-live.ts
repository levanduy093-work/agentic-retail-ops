import type { ExecArgs } from "@medusajs/framework/types"
import { getPayosSettings } from "../modules/payment-hub/payos-connection"
import { PayosClient } from "../modules/payos-payment/payos-client"

export default async function checkPayosLive({ container }: ExecArgs) {
  console.log("\n========================================================")
  console.log("💳 KIỂM TRA CẤU HÌNH VÀ KẾT NỐI PAYOS")
  console.log("========================================================\n")

  const settings = await getPayosSettings(container)
  console.log("1. THÔNG TIN CẤU HÌNH PAYOS HIỆN TẠI:")
  console.log(`   - Client ID: ${settings.client_id || "Chưa có"}`)
  console.log(`   - API Key: ${settings.api_key ? "✓ Đã có" : "✗ Chưa có"}`)
  console.log(`   - Checksum Key: ${settings.checksum_key ? "✓ Đã có" : "✗ Chưa có"}`)
  console.log(`   - Environment: ${settings.environment}`)
  console.log(`   - Is Enabled: ${settings.is_enabled}`)
  console.log(`   - Display Title: ${settings.display_title}`)

  const client = new PayosClient({
    clientId: settings.client_id,
    apiKey: settings.api_key,
    checksumKey: settings.checksum_key,
    environment: settings.environment,
  })

  console.log(`\n2. TRẠNG THÁI CLIENT:`)
  console.log(`   - isConfigured: ${client.isConfigured()}`)

  if (client.isConfigured()) {
    console.log("\n3. THỬ TẠO LINK THANH TOÁN TEST:")
    try {
      const orderCode = Number(String(Date.now()).slice(-7))
      const paymentLink = await client.createPaymentLink({
        orderCode,
        amount: 36900,
        description: `DH${orderCode}`,
        cancelUrl: "http://localhost:8000/checkout",
        returnUrl: "http://localhost:8000/checkout",
      })
      console.log(`   ✓ Tạo payment link thành công!`)
      console.log(`   - Checkout URL: ${paymentLink.checkoutUrl}`)
      console.log(`   - QR Code: ${paymentLink.qrCode ? "✓ Có QR" : "✗ Không có"}`)
    } catch (err: any) {
      console.log(`   ✗ Lỗi tạo link PayOS: ${err.message}`)
    }
  }

  console.log("\n========================================================")
}
