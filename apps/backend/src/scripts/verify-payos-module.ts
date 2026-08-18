import { ExecArgs } from "@medusajs/framework/types"
import { PAYMENT_HUB_MODULE } from "../modules/payment-hub"
import type PaymentHubModuleService from "../modules/payment-hub/service"
import {
  encryptPaymentSecret,
  decryptPaymentSecret,
  buildSecretHint,
} from "../modules/payment-hub/credential-vault"
import { PayosClient } from "../modules/payos-payment/payos-client"
import { getPayosSettings } from "../modules/payment-hub/payos-connection"

export default async function verifyPayosModule({ container }: ExecArgs) {
  console.log("=== BẮT ĐẦU KIỂM TRA MODULE THANH TOÁN PAYOS VIETQR ===")

  // 1. Kiểm tra mã hóa AES-256-GCM
  console.log("\n[1] Kiểm tra Credential Vault (Mã hóa AES-256-GCM)...")
  const testApiKey = "test_api_key_123456789abcdef"
  const encrypted = encryptPaymentSecret(testApiKey)
  const decrypted = decryptPaymentSecret(encrypted)
  const hint = buildSecretHint(testApiKey)

  if (decrypted !== testApiKey) {
    throw new Error("Mã hóa/Giải mã thất bại: Dữ liệu không khớp!")
  }
  console.log("✓ Mã hóa và giải mã AES-256-GCM thành công 100%")
  console.log(`✓ Secret Hint đã tạo: ${hint}`)

  // 2. Kiểm tra Service & Database Model
  console.log("\n[2] Kiểm tra PaymentHub Module Service & Database Storage...")
  const paymentHub = container.resolve<PaymentHubModuleService>(PAYMENT_HUB_MODULE)
  
  const [existing] = (await paymentHub.listPaymentProviderConnections({
    code: "PAYOS",
  })) as any[]

  if (existing) {
    console.log(`✓ Đã tìm thấy bản ghi cấu hình PayOS trong PostgreSQL (ID: ${existing.id})`)
  } else {
    console.log("ℹ Chưa có bản ghi cấu hình trong DB, tạo cấu hình mẫu...")
    const created = await paymentHub.createPaymentProviderConnections({
      code: "PAYOS",
      name: "PayOS VietQR",
      provider_id: "payos",
      environment: "SANDBOX",
      is_enabled: false,
      configuration: {
        client_id: "test-client-id",
        is_timeout_enabled: true,
        timeout_minutes: 15,
        display_title: "VietQR / Chuyển khoản ngân hàng",
        order_prefix: "DH",
      },
      encrypted_secret: encrypted.encrypted_secret,
      encryption_iv: encrypted.encryption_iv,
      encryption_tag: encrypted.encryption_tag,
      key_version: encrypted.key_version,
      secret_hint: hint,
    })
    console.log(`✓ Tạo cấu hình PayOS mẫu trong DB thành công (ID: ${created.id})`)
  }

  // 3. Kiểm tra tự động khôi phục cấu hình (Auto-recovery)
  console.log("\n[3] Kiểm tra Auto-recovery (Tải cấu hình tự động từ DB)...")
  const runtimeSettings = await getPayosSettings(container)
  console.log(`✓ Cổng thanh toán: ${runtimeSettings.display_title}`)
  console.log(`✓ Môi trường: ${runtimeSettings.environment}`)
  console.log(`✓ Thời gian hết hạn thanh toán: ${runtimeSettings.timeout_minutes} phút (Bật: ${runtimeSettings.is_timeout_enabled})`)
  console.log(`✓ Tiền tố mã đơn: ${runtimeSettings.order_prefix}`)

  // 4. Kiểm tra PayOS Client & Tính toán chữ ký HMAC-SHA256
  console.log("\n[4] Kiểm tra PayOS Client & Chữ ký HMAC-SHA256...")
  const dummyClient = new PayosClient({
    clientId: "dummy-client-id",
    apiKey: "dummy-api-key",
    checksumKey: "dummy-checksum-key-123456",
    environment: "sandbox",
  })

  const signature = dummyClient.createPaymentLinkSignature({
    amount: 50000,
    cancelUrl: "http://localhost:8000/checkout",
    description: "DH123456",
    orderCode: 123456,
    returnUrl: "http://localhost:8000/checkout",
  })
  console.log(`✓ Chữ ký HMAC-SHA256 sinh ra: ${signature}`)

  // 5. Kiểm tra Webhook verification
  console.log("\n[5] Kiểm tra Xác thực Webhook HMAC-SHA256...")
  const webhookData = {
    orderCode: 123456,
    amount: 50000,
    description: "DH123456",
    accountNumber: "999999999",
    reference: "REF12345",
    transactionDateTime: "2026-08-18 20:00:00",
    currency: "VND",
    paymentLinkId: "plink_123",
    code: "00",
    desc: "success",
  }
  const webhookSignature = dummyClient.createSignatureFromObj(webhookData)
  const isVerified = dummyClient.verifyWebhookData({
    code: "00",
    desc: "success",
    data: webhookData,
    signature: webhookSignature,
  })

  if (!isVerified) {
    throw new Error("Xác thực Webhook thất bại!")
  }
  console.log("✓ Xác thực chữ ký Webhook hợp lệ 100%")

  console.log("\n=== TẤT CẢ CÁC BƯỚC KIỂM TRA ĐÃ HOÀN TẤT THÀNH CÔNG ===")
}
