import { NextResponse } from "next/server"

import {
  customerChatProxyErrorResponse,
  getCustomerChatAuthorization,
  loginRequiredResponse,
  sdk,
} from "@lib/customer-chat/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const authorization = await getCustomerChatAuthorization()

  if (!authorization) {
    return loginRequiredResponse()
  }

  try {
    const conversation = await sdk.client.fetch(
      "/store/customer-chat/customer/active-conversation",
      {
        cache: "no-store",
        headers: authorization,
        method: "GET",
      }
    )

    return NextResponse.json(conversation)
  } catch (error) {
    return customerChatProxyErrorResponse(error)
  }
}
