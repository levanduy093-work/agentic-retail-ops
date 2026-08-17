import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GhnClient } from "../../../../modules/ghn-fulfillment/ghn-client"
import { VietnamAddressService } from "../../../../modules/ghn-fulfillment/services/vietnam-address-service"
import { getGhnSettings } from "../../../../modules/shipping-hub/ghn-connection"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const districtId = req.query.district_id
    ? Number(req.query.district_id)
    : undefined

  if (!districtId) {
    res.status(400).json({ message: "district_id is required" })
    return
  }

  try {
    const settings = await getGhnSettings(req.scope)
    const wards = await VietnamAddressService.getWards(
      districtId,
      new GhnClient({
        apiToken: settings.api_token,
        baseUrl: settings.base_url,
        environment: settings.environment,
        shopId: settings.shop_id,
      })
    )
    res.json({
      wards: wards.map((w) => ({
        code: w.WardCode,
        district_id: w.DistrictID,
        name: w.WardName,
        extensions: w.NameExtension || [],
      })),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ message: `Không thể tải danh sách phường xã: ${msg}` })
  }
}
