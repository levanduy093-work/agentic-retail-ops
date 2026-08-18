import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PAYMENT_HUB_MODULE } from "../../modules/payment-hub"
import type PaymentHubModuleService from "../../modules/payment-hub/service"
import { PayosClient } from "../../modules/payos-payment/payos-client"
import { getPayosSettings } from "../../modules/payment-hub/payos-connection"
import type { TestPayosProviderType } from "../../api/admin/payments/providers/validators"

export const verifyPayosProviderStep = createStep(
  "verify-payos-provider",
  async (input: TestPayosProviderType, { container }) => {
    const currentSettings = await getPayosSettings(container)

    const clientId = (input.client_id || currentSettings.client_id || "").trim()
    const apiKey = (input.api_key || currentSettings.api_key || "").trim()
    const checksumKey = (input.checksum_key || currentSettings.checksum_key || "").trim()
    const environment = input.environment || currentSettings.environment

    if (!clientId || !apiKey) {
      return new StepResponse({
        success: false,
        message: "Vui lòng nhập Client ID và API Key để kiểm tra kết nối.",
      })
    }

    const client = new PayosClient({
      clientId,
      apiKey,
      checksumKey: checksumKey || "dummy_checksum_for_ping",
      environment,
    })

    const verificationResult = await client.verifyCredentials()

    if (verificationResult.success) {
      try {
        const paymentHub = container.resolve<PaymentHubModuleService>(
          PAYMENT_HUB_MODULE
        )
        const [existing] = (await paymentHub.listPaymentProviderConnections({
          code: "PAYOS",
        })) as any[]

        if (existing) {
          await paymentHub.updatePaymentProviderConnections({
            id: existing.id,
            last_verified_at: new Date(),
            last_verification: {
              success: true,
              latency_ms: verificationResult.latencyMs,
              message: verificationResult.message,
              environment,
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

export const verifyPayosProviderWorkflow = createWorkflow(
  "verify-payos-provider",
  function (input: TestPayosProviderType) {
    const result = verifyPayosProviderStep(input)
    return new WorkflowResponse(result)
  }
)
