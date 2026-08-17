import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { GhnClient } from "../../../../../../modules/ghn-fulfillment/ghn-client"
import { getGhnSettings } from "../../../../../../modules/shipping-hub/ghn-connection"
import { configureGhnCarrierWorkflow } from "../../../../../../workflows/shipping-hub/configure-ghn-carrier"
import type { TestGhnCarrier } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<TestGhnCarrier>,
  res: MedusaResponse
) {
  const current = await getGhnSettings(req.scope)
  const input = req.validatedBody
  const apiToken = input.api_token || current.api_token

  if (!apiToken) {
    res.status(400).json({
      message: "Nhập API Token trước khi kiểm tra kết nối GHN.",
      success: false,
    })
    return
  }

  const client = new GhnClient({
    apiToken,
    baseUrl: input.base_url ?? current.base_url,
    environment: input.environment ?? current.environment,
    shopId: input.shop_id ?? current.shop_id,
  })
  const verification = await client.testConnection()

  if (!verification.success) {
    res.status(400).json(verification)
    return
  }

  const { result: carrier } = await configureGhnCarrierWorkflow(req.scope).run({
    input: {
      ...input,
      api_token: apiToken,
      is_enabled: true,
      verification,
    },
  })

  res.json({ ...verification, carrier })
}
