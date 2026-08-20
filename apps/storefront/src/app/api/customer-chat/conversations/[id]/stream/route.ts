import { NextRequest } from "next/server"

import {
  customerChatBackendUrl,
  customerChatPublishableKey,
  getCustomerChatAuthorization,
  loginRequiredResponse,
} from "@lib/customer-chat/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authorization = await getCustomerChatAuthorization()

  if (!authorization) {
    return loginRequiredResponse()
  }

  const { id } = await params
  let backendResponse: Response

  try {
    backendResponse = await fetch(
      `${customerChatBackendUrl}/store/customer-chat/conversations/${encodeURIComponent(
        id
      )}/stream`,
      {
        cache: "no-store",
        headers: {
          accept: "text/event-stream",
          authorization: authorization.authorization,
          ...(customerChatPublishableKey
            ? { "x-publishable-api-key": customerChatPublishableKey }
            : {}),
        },
        signal: request.signal,
      }
    )
  } catch {
    return new Response(null, { status: 502 })
  }

  if (!backendResponse.ok || !backendResponse.body) {
    return new Response(null, {
      status: backendResponse.status || 502,
      statusText: backendResponse.statusText,
    })
  }

  return new Response(backendResponse.body, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  })
}
