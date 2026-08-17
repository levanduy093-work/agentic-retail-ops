import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { DevAccessStore } from "../../../lib/dev-access/dev-access-store"
import type { UpdateDevAccessInput } from "../../../lib/dev-access/types"

export async function GET(
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const settings = DevAccessStore.getSettings()
  res.json({
    settings,
    tunnel: {
      is_configured: Boolean(process.env.CLOUDFLARE_TUNNEL_TOKEN),
      public_domain: settings.public_domain,
      command_up: "pnpm run tunnel:up",
      command_down: "pnpm run tunnel:down",
      command_status: "pnpm run tunnel:status",
    },
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const body = req.body as UpdateDevAccessInput
  const updated = DevAccessStore.updateSettings(body)
  res.json({
    message: updated.public_access_enabled
      ? "Đã mở truy cập ngoài & chia sẻ link."
      : "Đã bật chế độ Dev An toàn (Chặn truy cập ngoài).",
    settings: updated,
  })
}
