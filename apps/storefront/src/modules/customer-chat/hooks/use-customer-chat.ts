"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

export type ProductMediaItem = {
  image_url: string
  product_id: string
  product_url?: string | null
  title: string
}

export type ChatMessage = {
  body: string
  id: string
  occurred_at: string
  product_media?: ProductMediaItem[]
  sender_type: "customer" | "agent" | "system"
}

type StoreMessageResponse = {
  conversation_id: string
  inbound_message: ChatMessage
  response_message?: ChatMessage | null
}

type ConversationDetailResponse = {
  conversation: {
    id: string
    title: string
  }
  messages: ChatMessage[]
}

const STORAGE_KEY = "synapse_storefront_chat_conversation_id"

export function useCustomerChat(
  customer?: HttpTypes.StoreCustomer | null,
  locale: string = "vi"
) {
  const [isOpen, setIsOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // 1. Fetch active conversation for logged-in customer
  useEffect(() => {
    let isMounted = true

    if (customer?.id) {
      sdk.client
        .fetch<ConversationDetailResponse>(
          `/store/customer-chat/customer/active-conversation?customer_id=${encodeURIComponent(
            customer.id
          )}`
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
        .catch(() => {})
    } else {
      setConversationId(null)
      setMessages([])
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

    const backendUrl =
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
    const publishableKey =
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
    const streamUrl = `${backendUrl}/store/customer-chat/conversations/${conversationId}/stream?publishable_key=${encodeURIComponent(
      publishableKey
    )}`

    const es = new EventSource(streamUrl)
    eventSourceRef.current = es

    es.onopen = () => {
      setIsLive(true)
    }

    es.addEventListener("message.created", (event) => {
      try {
        const msg = JSON.parse(event.data) as ChatMessage
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
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const clientMsgId = `temp-${Date.now()}`
      const optimisticMsg: ChatMessage = {
        body: trimmed,
        id: clientMsgId,
        occurred_at: new Date().toISOString(),
        sender_type: "customer",
      }

      setMessages((prev) => [...prev, optimisticMsg])
      setIsLoading(true)

      const customerName = customer
        ? [customer.first_name, customer.last_name]
            .filter(Boolean)
            .join(" ") || undefined
        : undefined

      try {
        const res = await sdk.client.fetch<StoreMessageResponse>(
          "/store/customer-chat/messages",
          {
            body: {
              client_message_id: clientMsgId,
              conversation_id: conversationId ?? undefined,
              customer_email: customer?.email || undefined,
              customer_id: customer?.id || undefined,
              customer_name: customerName,
              customer_phone: customer?.phone || undefined,
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
          const updated = [...filtered, res.inbound_message]
          if (
            res.response_message &&
            !updated.some((m) => m.id === res.response_message?.id)
          ) {
            updated.push(res.response_message)
          }
          return updated
        })
      } catch (err) {
        console.error("Failed to send chat message:", err)
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
    conversationId,
    isLoading,
    isLive,
    isOpen,
    messages,
    sendMessage,
    setIsOpen,
  }
}
