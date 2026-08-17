import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GhnClient } from "../../../../modules/ghn-fulfillment/ghn-client"
import { VietnamAddressService } from "../../../../modules/ghn-fulfillment/services/vietnam-address-service"
import { getGhnSettings } from "../../../../modules/shipping-hub/ghn-connection"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const settings = await getGhnSettings(req.scope)
    const provinces = await VietnamAddressService.getProvinces(
      new GhnClient({
        apiToken: settings.api_token,
        baseUrl: settings.base_url,
        environment: settings.environment,
        shopId: settings.shop_id,
      })
    )
    res.json({
      provinces: provinces.map((p) => ({
        id: p.ProvinceID,
        name: p.ProvinceName,
        code: p.Code,
        extensions: p.NameExtension || [],
      })),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ message: `Không thể tải danh sách tỉnh thành: ${msg}` })
  }
}
