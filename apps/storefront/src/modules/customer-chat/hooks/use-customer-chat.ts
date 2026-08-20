"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Medusa from "@medusajs/js-sdk"
import { HttpTypes } from "@medusajs/types"

export type ProductMediaItem = {
  image_url: string
  product_id: string
  product_url?: string | null
  title: string
}

export type ChatImageAttachment = {
  id: string
  url: string
}

export type ChatMessage = {
  body: string
  id: string
  occurred_at: string
  image_attachments?: ChatImageAttachment[]
  product_media?: ProductMediaItem[]
  sender_type: "customer" | "agent" | "system"
}

type StoreMessageResponse = {
  conversation_id: string
  inbound_message: ChatMessage
  response_message?: ChatMessage | null
}

type StoreCustomerChatUploadResponse = {
  files: ChatImageAttachment[]
}

type ConversationDetailResponse = {
  conversation: {
    id: string
    title: string
  }
  messages: ChatMessage[]
}

const STORAGE_KEY = "synapse_storefront_chat_conversation_id"

let customerChatSdk: Medusa | null = null

function getCustomerChatSdk() {
  if (!customerChatSdk) {
    customerChatSdk = new Medusa({
      baseUrl: window.location.origin,
      publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
    })
  }

  return customerChatSdk
}

function normalizeChatMessage(message: ChatMessage & {
  structured_content?: Record<string, unknown> | null
}) {
  const structured = message.structured_content
  return {
    ...message,
    image_attachments:
      message.image_attachments ??
      (Array.isArray(structured?.image_attachments)
        ? (structured.image_attachments as ChatImageAttachment[])
        : []),
    product_media:
      message.product_media ??
      (Array.isArray(structured?.product_media)
        ? (structured.product_media as ProductMediaItem[])
        : []),
  }
}

function getChatErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    if (/unauthorized|forbidden/i.test(error.message)) {
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để chat với cửa hàng."
    }

    return error.message
  }

  return "Không thể gửi tin nhắn lúc này. Bạn thử lại giúp shop nhé."
}

export function useCustomerChat(
  customer?: HttpTypes.StoreCustomer | null,
  locale: string = "vi"
) {
  const [isOpen, setIsOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // 1. Fetch active conversation for logged-in customer
  useEffect(() => {
    let isMounted = true

    if (customer?.id) {
      getCustomerChatSdk()
        .client
        .fetch<ConversationDetailResponse>(
          "/api/customer-chat/active-conversation"
        )
        .then((data) => {
          if (isMounted) {
            if (data?.conversation?.id) {
              setConversationId(data.conversation.id)
              setMessages(data.messages || [])
              try {
                localStorage.setItem(STORAGE_KEY, data.conversation.id)
              } catch {}
            } else {
              setConversationId(null)
              setMessages([])
            }
          }
        })
        .catch((error) => {
          if (isMounted) {
            setErrorMessage(getChatErrorMessage(error))
          }
        })
    } else {
      setConversationId(null)
      setMessages([])
      setErrorMessage(null)
    }

    return () => {
      isMounted = false
    }
  }, [customer?.id])

  // 2. Connect SSE stream for real-time incoming messages
  useEffect(() => {
    if (!conversationId || !isOpen) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsLive(false)
      }
      return
    }

    const streamUrl = `/api/customer-chat/conversations/${encodeURIComponent(
      conversationId
    )}/stream`

    const es = new EventSource(streamUrl)
    eventSourceRef.current = es

    es.onopen = () => {
      setIsLive(true)
    }

    es.addEventListener("message.created", (event) => {
      try {
        const msg = normalizeChatMessage(
          JSON.parse(event.data) as ChatMessage & {
            structured_content?: Record<string, unknown> | null
          }
        )
        setMessages((prev) => {
          if (prev.some((existing) => existing.id === msg.id)) {
            return prev
          }
          return [...prev, msg]
        })
        setIsLoading(false)
      } catch {}
    })

    es.onerror = () => {
      setIsLive(false)
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      setIsLive(false)
    }
  }, [conversationId, isOpen])

  // 3. Send message action
  const sendMessage = useCallback(
    async (text: string, images: File[] = []) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading || images.length > 3) return

      const clientMsgId = `temp-${Date.now()}`
      const optimisticMsg: ChatMessage = {
        body: trimmed,
        id: clientMsgId,
        image_attachments: images.map((file, index) => ({
          id: `${clientMsgId}:image:${index}`,
          url: URL.createObjectURL(file),
        })),
        occurred_at: new Date().toISOString(),
        sender_type: "customer",
      }

      setMessages((prev) => [...prev, optimisticMsg])
      setIsLoading(true)
      setErrorMessage(null)

      try {
        let attachmentIds: string[] = []
        if (images.length) {
          const formData = new FormData()
          images.forEach((image) => formData.append("files", image))
          const uploaded = await getCustomerChatSdk().client.fetch<StoreCustomerChatUploadResponse>(
            "/api/customer-chat/uploads",
            { body: formData, method: "POST" }
          )
          attachmentIds = uploaded.files.map((file) => file.id)
        }
        const res = await getCustomerChatSdk().client.fetch<StoreMessageResponse>(
          "/api/customer-chat/messages",
          {
            body: {
              attachment_ids: attachmentIds,
              client_message_id: clientMsgId,
              conversation_id: conversationId ?? undefined,
              locale: locale.startsWith("vi") ? "vi" : "en",
              message: trimmed,
            },
            method: "POST",
          }
        )

        if (res.conversation_id && res.conversation_id !== conversationId) {
          setConversationId(res.conversation_id)
          try {
            localStorage.setItem(STORAGE_KEY, res.conversation_id)
          } catch {}
        }

        // Replace optimistic msg with confirmed inbound message
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== clientMsgId)
          const updated = [
            ...filtered,
            normalizeChatMessage(res.inbound_message),
          ]
          if (
            res.response_message &&
            !updated.some((m) => m.id === res.response_message?.id)
          ) {
            updated.push(normalizeChatMessage(res.response_message))
          }
          return updated
        })
      } catch (err) {
        setMessages((prev) => prev.filter((message) => message.id !== clientMsgId))
        setErrorMessage(getChatErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId, customer, isLoading, locale]
  )

  const clearChat = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    setConversationId(null)
    setMessages([])
  }, [])

  return {
    clearChat,
    errorMessage,
    conversationId,
    isLoading,
    isLive,
    isOpen,
    messages,
    sendMessage,
    setIsOpen,
  }
}
