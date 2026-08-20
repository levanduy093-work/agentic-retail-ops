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
    const message = await sdk.client.fetch("/store/customer-chat/messages", {
      body: await request.json(),
      cache: "no-store",
      headers: authorization,
      method: "POST",
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    return customerChatProxyErrorResponse(error)
  }
}
