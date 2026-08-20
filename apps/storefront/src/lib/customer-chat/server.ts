import "server-only"

import { FetchError } from "@medusajs/js-sdk"
import { NextResponse } from "next/server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"

const LOGIN_REQUIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để chat với cửa hàng."

export const customerChatBackendUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://127.0.0.1:9000"

export const customerChatPublishableKey =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

export async function getCustomerChatAuthorization() {
  const headers = await getAuthHeaders()

  if (!("authorization" in headers)) {
    return null
  }

  return headers
}

export function loginRequiredResponse() {
  return NextResponse.json(
    { message: LOGIN_REQUIRED_MESSAGE },
    { status: 401 }
  )
}

export function customerChatProxyErrorResponse(error: unknown) {
  if (error instanceof FetchError) {
    const status = error.status && error.status >= 400 ? error.status : 502
    const message =
      status === 401 || status === 403
        ? LOGIN_REQUIRED_MESSAGE
        : error.message || "Không thể kết nối tới hệ thống chăm sóc khách hàng."

    return NextResponse.json({ message }, { status })
  }

  return NextResponse.json(
    { message: "Không thể kết nối tới hệ thống chăm sóc khách hàng." },
    { status: 502 }
  )
}

export { sdk }
