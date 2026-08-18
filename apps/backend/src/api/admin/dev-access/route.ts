import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { DevAccessStore } from "../../../lib/dev-access/dev-access-store"
import type { UpdateDevAccessInput } from "../../../lib/dev-access/types"

function publicStorefrontUrl() {
  const value = process.env.CUSTOMER_STOREFRONT_BASE_URL?.trim()
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({
    settings: DevAccessStore.getPublicSettings(),
    public_storefront_url: publicStorefrontUrl(),
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as UpdateDevAccessInput
  if (
    (body.public_access_enabled !== undefined && typeof body.public_access_enabled !== "boolean") ||
    (body.passcode !== undefined && typeof body.passcode !== "string")
  ) {
    res.status(400).json({ message: "Dữ liệu cấu hình không hợp lệ." })
    return
  }

  try {
    const settings = DevAccessStore.updateSettings(body)
    res.json({
      message: settings.public_access_enabled
        ? "Storefront đã được mở Public."
        : "Storefront đã được chuyển sang Private.",
      settings,
      public_storefront_url: publicStorefrontUrl(),
    })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Không thể lưu cấu hình.",
    })
  }
}
