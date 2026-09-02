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

export type CartHandoff = {
  cart_id: string
}

export type ChatMessage = {
  body: string
  cart_handoff?: CartHandoff
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
const PENDING_STORAGE_PREFIX = "synapse_storefront_chat_pending"

type PendingTextMessage = {
  client_message_id: string
  occurred_at: string
  text: string
}

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
    cart_handoff:
      message.cart_handoff ??
      (isCartHandoff(structured?.cart_handoff) ? structured.cart_handoff : undefined),
  }
}

function isCartHandoff(value: unknown): value is CartHandoff {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { cart_id?: unknown }).cart_id === "string" &&
      (value as { cart_id: string }).cart_id.trim()
  )
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

function pendingStorageKey(customerId: string) {
  return `${PENDING_STORAGE_PREFIX}:${customerId}`
}

function readPendingTextMessages(customerId: string): PendingTextMessage[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(pendingStorageKey(customerId)) ?? "[]"
    ) as unknown
    if (!Array.isArray(value)) return []

    return value.filter(
      (message): message is PendingTextMessage =>
        Boolean(
          message &&
            typeof message === "object" &&
            typeof (message as PendingTextMessage).client_message_id === "string" &&
            typeof (message as PendingTextMessage).occurred_at === "string" &&
            typeof (message as PendingTextMessage).text === "string"
        )
    )
  } catch {
    return []
  }
}

function writePendingTextMessages(
  customerId: string,
  messages: PendingTextMessage[]
) {
  try {
    localStorage.setItem(pendingStorageKey(customerId), JSON.stringify(messages))
  } catch {}
}

function shouldQueueForRetry(error: unknown) {
  const message = getChatErrorMessage(error)
  return !/unauthorized|forbidden|invalid|validation|too many/i.test(message)
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
  const replayingPendingMessageRef = useRef(false)

  const confirmMessage = useCallback(
    (clientMsgId: string, res: StoreMessageResponse) => {
      if (res.conversation_id && res.conversation_id !== conversationId) {
        setConversationId(res.conversation_id)
        try {
          localStorage.setItem(STORAGE_KEY, res.conversation_id)
        } catch {}
      }

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== clientMsgId)
        const updated = [...filtered, normalizeChatMessage(res.inbound_message)]
        if (
          res.response_message &&
          !updated.some((m) => m.id === res.response_message?.id)
        ) {
          updated.push(normalizeChatMessage(res.response_message))
        }
        return updated
      })
    },
    [conversationId]
  )

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

  // Text-only messages survive a tab reload or backend outage. The stable
  // client_message_id makes replay safe even if the first POST succeeded but
  // its response was lost while the server was restarting.
  useEffect(() => {
    if (!customer?.id) return

    const replayNext = async () => {
      if (replayingPendingMessageRef.current || !navigator.onLine) return
      const [pending] = readPendingTextMessages(customer.id)
      if (!pending) return

      replayingPendingMessageRef.current = true
      try {
        const res = await getCustomerChatSdk().client.fetch<StoreMessageResponse>(
          "/api/customer-chat/messages",
          {
            body: {
              client_message_id: pending.client_message_id,
              conversation_id: conversationId ?? undefined,
              locale: locale.startsWith("vi") ? "vi" : "en",
              message: pending.text,
            },
            method: "POST",
          }
        )
        writePendingTextMessages(
          customer.id,
          readPendingTextMessages(customer.id).filter(
            (message) => message.client_message_id !== pending.client_message_id
          )
        )
        confirmMessage(pending.client_message_id, res)
        setErrorMessage(null)
      } catch {
        // Leave it in local storage for the next online/interval retry.
      } finally {
        replayingPendingMessageRef.current = false
      }
    }

    void replayNext()
    window.addEventListener("online", replayNext)
    const interval = window.setInterval(replayNext, 15_000)
    return () => {
      window.removeEventListener("online", replayNext)
      window.clearInterval(interval)
    }
  }, [confirmMessage, conversationId, customer?.id, locale])

  // 3. Send message action
  const sendMessage = useCallback(
    async (text: string, images: File[] = []) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const clientMsgId = `temp-${crypto.randomUUID()}`
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

        confirmMessage(clientMsgId, res)
      } catch (err) {
        if (customer?.id && images.length === 0 && shouldQueueForRetry(err)) {
          const pending = readPendingTextMessages(customer.id)
          if (!pending.some((message) => message.client_message_id === clientMsgId)) {
            writePendingTextMessages(customer.id, [
              ...pending,
              {
                client_message_id: clientMsgId,
                occurred_at: optimisticMsg.occurred_at,
                text: trimmed,
              },
            ])
          }
          setErrorMessage("Tin nhắn đã được giữ lại và sẽ tự gửi khi server hoạt động lại.")
        } else {
          setMessages((prev) => prev.filter((message) => message.id !== clientMsgId))
          setErrorMessage(getChatErrorMessage(err))
        }
      } finally {
        setIsLoading(false)
      }
    },
    [confirmMessage, conversationId, customer, isLoading, locale]
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
