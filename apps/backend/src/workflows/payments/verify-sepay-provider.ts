import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PAYMENT_HUB_MODULE } from "../../modules/payment-hub"
import type PaymentHubModuleService from "../../modules/payment-hub/service"
import { SepayClient } from "../../modules/sepay-payment/sepay-client"
import { getSepaySettings } from "../../modules/payment-hub/sepay-connection"
import type { TestPaymentProviderType } from "../../api/admin/payments/providers/validators"

export const verifySepayProviderStep = createStep(
  "verify-sepay-provider",
  async (input: TestPaymentProviderType, { container }) => {
    const currentSettings = await getSepaySettings(container)

    const apiKey = (input.api_key || currentSettings.api_key || "").trim()
    const accountNumber = (input.account_number || currentSettings.account_number || "").trim()
    const bankCode = (input.bank_code || currentSettings.bank_code || "MB").trim()

    if (!apiKey) {
      return new StepResponse({
        success: false,
        message: "Vui lòng nhập API Token để kiểm tra kết nối với SePay.",
      })
    }

    const client = new SepayClient({
      apiKey,
      accountNumber,
      bankCode,
    })

    const verificationResult = await client.verifyCredentials()

    if (verificationResult.success) {
      try {
        const paymentHub = container.resolve<PaymentHubModuleService>(
          PAYMENT_HUB_MODULE
        )
        const [existing] = (await paymentHub.listPaymentProviderConnections({
          code: "SEPAY",
        })) as any[]

        if (existing) {
          await paymentHub.updatePaymentProviderConnections({
            id: existing.id,
            last_verified_at: new Date(),
            last_verification: {
              success: true,
              latency_ms: verificationResult.latencyMs,
              message: verificationResult.message,
            },
          })
        }
      } catch {
        // Ignore background save errors
      }
    }

    return new StepResponse({
      success: verificationResult.success,
      message: verificationResult.message,
      latency_ms: verificationResult.latencyMs,
    })
  }
)

export const verifySepayProviderWorkflow = createWorkflow(
  "verify-sepay-provider",
  function (input: TestPaymentProviderType) {
    const result = verifySepayProviderStep(input)
    return new WorkflowResponse(result)
  }
)
