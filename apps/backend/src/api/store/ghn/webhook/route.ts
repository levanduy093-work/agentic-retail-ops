import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getGhnSettings } from "../../../../modules/shipping-hub/ghn-connection"
import {
  GhnWebhookInput,
  ingestGhnWebhookWorkflow,
} from "../../../../workflows/shipping-hub/ingest-ghn-webhook"

type GhnWebhookPayload = GhnWebhookInput & {
  OrderCode: string
  Status: string
  Type?: string
  TotalFee?: number
  Fee?: Record<string, number>
  Reason?: string
  Description?: string
  CODAmount?: number
  Weight?: number
  Time?: string
  ShopID?: number
  ClientOrderCode?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = req.body as GhnWebhookPayload

  if (!body?.OrderCode) {
    res.status(400).json({ message: "Invalid webhook payload: OrderCode missing" })
    return
  }

  const settings = await getGhnSettings(req.scope)
  if (body.ShopID && Number(body.ShopID) !== settings.shop_id) {
    logger.warn("[Shipping Hub] Ignored GHN callback for a different shop.")
    res.status(200).json({ ignored: true, success: true })
    return
  }

  const { result } = await ingestGhnWebhookWorkflow(req.scope).run({
    input: body,
  })
  res.status(200).json({
    duplicate: result.event.duplicate,
    success: true,
  })
}
