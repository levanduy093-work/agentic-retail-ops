import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { GhtkClient } from "../../../../../../modules/ghtk-fulfillment/ghtk-client"
import { getGhtkSettings } from "../../../../../../modules/shipping-hub/ghtk-connection"
import { configureGhtkCarrierWorkflow } from "../../../../../../workflows/shipping-hub/configure-ghtk-carrier"
import type { TestGhtkCarrier } from "../../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<TestGhtkCarrier>,
  res: MedusaResponse
) {
  const current = await getGhtkSettings(req.scope)
  const input = req.validatedBody
  const apiToken = input.api_token || current.api_token

  if (!apiToken) {
    res.status(400).json({
      message: "Nhập API Token trước khi kiểm tra kết nối GHTK.",
      success: false,
    })
    return
  }

  const client = new GhtkClient({
    apiToken,
    baseUrl: input.base_url ?? current.base_url,
    environment: input.environment ?? current.environment,
  })
  const verification = await client.testConnection()

  if (!verification.success) {
    res.status(400).json(verification)
    return
  }

  const { result: carrier } = await configureGhtkCarrierWorkflow(
    req.scope
  ).run({
    input: {
      ...input,
      api_token: apiToken,
      is_enabled: true,
      verification,
    },
  })

  res.json({ ...verification, carrier })
}
