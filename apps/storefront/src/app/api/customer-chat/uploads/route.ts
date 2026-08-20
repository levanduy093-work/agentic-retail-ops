import { NextRequest, NextResponse } from "next/server"

import {
  customerChatProxyErrorResponse,
  getCustomerChatAuthorization,
  loginRequiredResponse,
  sdk,
} from "@lib/customer-chat/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const authorization = await getCustomerChatAuthorization()

  if (!authorization) {
    return loginRequiredResponse()
  }

  try {
    const uploaded = await sdk.client.fetch("/store/customer-chat/uploads", {
      body: await request.formData(),
      cache: "no-store",
      headers: authorization,
      method: "POST",
    })

    return NextResponse.json(uploaded, { status: 201 })
  } catch (error) {
    return customerChatProxyErrorResponse(error)
  }
}
