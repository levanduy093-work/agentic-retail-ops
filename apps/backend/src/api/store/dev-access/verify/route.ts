import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DevAccessStore } from "../../../../lib/dev-access/dev-access-store"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const body = req.body as { passcode?: string }
  const passcode = body?.passcode || ""

  const isValid = DevAccessStore.verifyPasscode(passcode)

  if (!isValid) {
    res.status(401).json({
      message: "Mã PIN mở khóa không chính xác. Vui lòng thử lại.",
      success: false,
    })
    return
  }

  res.json({
    message: "Mở khóa chế độ phát triển thành công.",
    passcode_token: Buffer.from(passcode).toString("base64"),
    success: true,
  })
}
