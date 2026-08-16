/* eslint-disable @next/next/no-img-element */
"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { useCustomerChat, ProductMediaItem } from "../hooks/use-customer-chat"
import { HttpTypes } from "@medusajs/types"

type ChatWidgetProps = {
  countryCode?: string
  customer?: HttpTypes.StoreCustomer | null
  locale?: string
}

const QUICK_PROMPTS = [
  "Tư vấn áo khoác đi chơi",
  "Tìm áo thun size M dưới 300k",
  "Xem mẫu quần jeans",
  "Quy trình đổi trả hàng",
]

export default function CustomerChatWidget({
  countryCode = "vn",
  customer = null,
  locale = "vi",
}: ChatWidgetProps) {
  const {
    clearChat,
    isLoading,
    isLive,
    isOpen,
    messages,
    sendMessage,
    setIsOpen,
  } = useCustomerChat(customer, locale)

  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const customerDisplayName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.email
    : null

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (isOpen && customer) {
      scrollToBottom()
    }
  }, [messages, isOpen, isLoading, customer])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !customer) return
    const text = input
    setInput("")
    sendMessage(text)
  }

  const handlePromptClick = (promptText: string) => {
    if (!customer) return
    sendMessage(promptText)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {/* 1. Chat Window */}
      {isOpen && (
        <div className="mb-3 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all duration-200 ease-in-out dark:border-gray-800 dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-semibold text-white shadow">
                <span>🤖</span>
                {customer && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-900 ${
                      isLive ? "bg-green-500" : "bg-gray-400"
                    }`}
                    title={isLive ? "Realtime Active" : "Connecting"}
                  />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">
                  Synapse AI CSKH
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-300">
                  {customer ? (
                    <>
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          isLive ? "animate-pulse bg-green-400" : "bg-gray-400"
                        }`}
                      />
                      {customerDisplayName
                        ? `Chào ${customer.first_name || customerDisplayName}`
                        : "Trực tuyến"}
                    </>
                  ) : (
                    "Yêu cầu đăng nhập"
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {customer && (
                <button
                  type="button"
                  onClick={clearChat}
                  title="Làm mới đoạn chat"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng chat"
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          {!customer ? (
            /* REQUIRE LOGIN PROMPT */
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-100 to-indigo-100 text-2xl shadow-inner dark:from-blue-950 dark:to-indigo-950">
                🔒
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Đăng nhập để trò chuyện với AI
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Vui lòng đăng nhập tài khoản Synapse để bắt đầu trò chuyện, nhận tư
                vấn thời trang chuẩn size và tự động lưu lịch sử hội thoại.
              </p>

              <div className="my-5 w-full rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-left text-[11px] text-gray-600 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-300">
                <div className="flex items-center gap-2 py-1">
                  <span className="text-blue-500">✓</span>
                  <span>Đồng bộ lịch sử chat xuyên suốt thiết bị</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="text-blue-500">✓</span>
                  <span>Tư vấn mẫu quần áo cá nhân hoá theo size</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="text-blue-500">✓</span>
                  <span>Tra cứu đơn hàng và hỗ trợ đổi trả nhanh chóng</span>
                </div>
              </div>

              <a
                href={`/${locale}/${countryCode}/account`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 active:scale-98"
              >
                <span>Đăng nhập / Đăng ký ngay</span>
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </a>
            </div>
          ) : (
            /* AUTHENTICATED CHAT VIEW */
            <>
              {/* Message List */}
              <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50/50 p-4 dark:bg-gray-950/50">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl dark:bg-blue-950/50">
                      ✨
                    </div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Xin chào {customer.first_name || "bạn"}!
                    </h4>
                    <p className="mt-1 max-w-[260px] text-xs text-gray-500 dark:text-gray-400">
                      Mình là trợ lý CSKH Synapse. Mình có thể giúp bạn tìm kiếm
                      mẫu quần áo, kiểm tra size, giá và tư vấn phối đồ nhé.
                    </p>

                    {/* Quick Prompts */}
                    <div className="mt-4 flex w-full flex-col gap-1.5">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => handlePromptClick(prompt)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-700"
                        >
                          💬 {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isUser = msg.sender_type === "customer"
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isUser ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                              isUser
                                ? "bg-blue-600 text-white"
                                : "border border-gray-200/80 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                            }`}
                          >
                            {msg.body}
                          </div>

                          {/* Product Preview Media Cards */}
                          {msg.product_media && msg.product_media.length > 0 && (
                            <div className="mt-2 flex max-w-[90%] flex-col gap-2">
                              {msg.product_media.map((product) => (
                                <ProductPreviewCard
                                  key={product.product_id}
                                  product={product}
                                  countryCode={countryCode}
                                  locale={locale}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {isLoading && (
                      <div className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600" />
                        <span className="ml-1 text-[11px]">
                          Đang tìm mẫu và trả lời...
                        </span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 border-t border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập câu hỏi hoặc yêu cầu tìm mẫu..."
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow transition hover:bg-blue-700 disabled:opacity-40"
                  title="Gửi"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* 2. Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-blue-500/25 active:scale-95"
        aria-label="Chat với CSKH Synapse"
      >
        {isOpen ? (
          <svg
            className="h-6 w-6 transition duration-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        ) : (
          <>
            <svg
              className="h-6 w-6 transition duration-200 group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500 text-[9px] font-bold text-white items-center justify-center">
                1
              </span>
            </span>
          </>
        )}
      </button>
    </div>
  )
}

function ProductPreviewCard({
  countryCode,
  locale,
  product,
}: {
  countryCode: string
  locale: string
  product: ProductMediaItem
}) {
  const productUrl =
    product.product_url ||
    `/${locale}/${countryCode}/products/${product.product_id}`

  return (
    <div className="flex items-center gap-2.5 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.title}
          className="h-14 w-14 rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
          loading="lazy"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-800">
          👕
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <span className="truncate text-xs font-semibold text-gray-900 dark:text-white">
          {product.title}
        </span>
        <a
          href={productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Xem chi tiết
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  )
}
