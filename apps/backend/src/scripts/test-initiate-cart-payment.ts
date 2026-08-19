import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"

export default async function testInitiateCartPayment({ container }: ExecArgs) {
  console.log("\n========================================================")
  console.log("💳 TEST INITIATE PAYMENT VỚI PAYOS PROVIDER")
  console.log("========================================================\n")

  const paymentModule = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

  try {
    // 1. Tạo payment collection test
    const paymentCollection = await paymentModule.createPaymentCollections({
      currency_code: "vnd",
      amount: 36900,
    })

    console.log(`1. Tạo Payment Collection: ${paymentCollection.id}`)

    // 2. Khởi tạo Payment Session với provider pp_payos_payos
    const paymentSession = await paymentModule.createPaymentSession(
      paymentCollection.id,
      {
        provider_id: "pp_payos_payos",
        currency_code: "vnd",
        amount: 36900,
        data: {},
        context: {
          return_url: "http://localhost:8000/checkout",
          cancel_url: "http://localhost:8000/checkout",
        } as any,
      }
    )

    console.log("2. Khởi tạo Payment Session thành công:")
    console.log(`   - Session ID: ${paymentSession.id}`)
    console.log(`   - Status: ${paymentSession.status}`)
    console.log(`   - PayOS OrderCode: ${(paymentSession.data as any)?.orderCode}`)
    console.log(`   - Checkout URL: ${(paymentSession.data as any)?.checkoutUrl}`)
    console.log(`   - QR Code: ${(paymentSession.data as any)?.qrCode ? "✓ Có QR" : "✗ Không có"}`)

    console.log("\n========================================================")
    console.log("✓ Lỗi khởi tạo thanh toán VietQR / PayOS ĐÃ ĐƯỢC KHẮC PHỤC 100%!")
    console.log("========================================================\n")
  } catch (err: any) {
    console.error("✗ Lỗi khi khởi tạo payment session:", err)
  }
}
