import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { passcode?: string }
  const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  if (!backendUrl || !publishableKey) return NextResponse.json({ message: "Storefront chưa được cấu hình backend." }, { status: 503 })

  const backendResponse = await fetch(`${backendUrl}/store/dev-access/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-publishable-api-key": publishableKey },
    body: JSON.stringify({ passcode: body.passcode || "" }),
    cache: "no-store",
  })
  const payload = await backendResponse.json() as { message?: string; session_token?: string; success?: boolean }
  if (!backendResponse.ok || !payload.success || !payload.session_token) return NextResponse.json({ message: payload.message || "Mã PIN không chính xác." }, { status: 401 })

  const response = NextResponse.json({ success: true })
  response.cookies.set("synapse_dev_access_session", payload.session_token, { httpOnly: true, path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:" })
  return response
}
