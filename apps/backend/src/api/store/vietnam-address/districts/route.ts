import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GhnClient } from "../../../../modules/ghn-fulfillment/ghn-client"
import { VietnamAddressService } from "../../../../modules/ghn-fulfillment/services/vietnam-address-service"
import { getGhnSettings } from "../../../../modules/shipping-hub/ghn-connection"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const provinceId = req.query.province_id
    ? Number(req.query.province_id)
    : undefined

  try {
    const settings = await getGhnSettings(req.scope)
    const districts = await VietnamAddressService.getDistricts(
      provinceId,
      new GhnClient({
        apiToken: settings.api_token,
        baseUrl: settings.base_url,
        environment: settings.environment,
        shopId: settings.shop_id,
      })
    )
    res.json({
      districts: districts.map((d) => ({
        id: d.DistrictID,
        province_id: d.ProvinceID,
        name: d.DistrictName,
        code: d.Code,
        extensions: d.NameExtension || [],
      })),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ message: `Không thể tải danh sách quận huyện: ${msg}` })
  }
}
