/* eslint-disable @next/next/no-img-element */
"use client"

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { HttpTypes } from "@medusajs/types"

import { useTranslation } from "@lib/i18n/client"
import { ProductMediaItem, useCustomerChat } from "../hooks/use-customer-chat"

type ChatWidgetProps = {
  countryCode?: string
  customer?: HttpTypes.StoreCustomer | null
  locale?: string
}

export default function CustomerChatWidget({
  countryCode = "vn",
  customer = null,
  locale = "vi",
}: ChatWidgetProps) {
  const t = useTranslation()
  const {
    clearChat,
    errorMessage,
    isLoading,
    isLive,
    isOpen,
    messages,
    sendMessage,
    setIsOpen,
  } = useCustomerChat(customer, locale)
  const [input, setInput] = useState("")
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickPrompts = [
    t("chat.quick_prompts.jackets"),
    t("chat.quick_prompts.tshirt_m"),
    t("chat.quick_prompts.jeans"),
    t("chat.quick_prompts.policy"),
  ]
  const supportBenefits = [
    t("chat.auth_benefit_orders"),
    t("chat.auth_benefit_size"),
    t("chat.auth_benefit_sync"),
  ]
  const customerDisplayName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.email
    : null

  useEffect(() => {
    if (isOpen && customer) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [customer, isLoading, isOpen, messages])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!input.trim() || isLoading || !customer) return

    const text = input
    const images = pendingImages
    setInput("")
    setPendingImages([])
    sendMessage(text, images)
  }

  const handleImagesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    setPendingImages(Array.from(event.target.files ?? []).slice(0, 3))
    event.target.value = ""
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end font-sans small:bottom-6 small:right-6">
      {isOpen && (
        <aside
          aria-label={t("chat.title")}
          className="mb-3 flex h-[min(580px,calc(100dvh-7.5rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[22px] border border-[#12231d]/15 bg-[#fbfcfa] text-[#12231d] shadow-[0_20px_60px_rgba(17,49,39,0.16)]"
        >
          <header className="flex items-center justify-between border-b border-[#12231d]/10 bg-[#f2f6f1] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <StoreMark />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#174b3d]">
                  {t("chat.title")}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#60716a]">
                  {customer && (
                    <span
                      aria-label={isLive ? t("chat.online") : t("chat.connecting")}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isLive ? "bg-[#174b3d]" : "bg-[#9aa9a1]"
                      }`}
                    />
                  )}
                  {customer
                    ? customerDisplayName || t("chat.online")
                    : t("chat.auth_required_badge")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {customer && (
                <button
                  type="button"
                  onClick={clearChat}
                  title={t("chat.clear_chat")}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#60716a] transition hover:bg-white hover:text-[#174b3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174b3d]/35 active:scale-[0.96]"
                >
                  <RefreshIcon />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={t("chat.close_chat")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#60716a] transition hover:bg-white hover:text-[#174b3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174b3d]/35 active:scale-[0.96]"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          {customer ? (
            <AuthenticatedChat
              countryCode={countryCode}
              customerName={customer.first_name || customerDisplayName || ""}
              errorMessage={errorMessage}
              imageInputRef={imageInputRef}
              input={input}
              isLoading={isLoading}
              locale={locale}
              messages={messages}
              messagesEndRef={messagesEndRef}
              onImagesSelected={handleImagesSelected}
              onInputChange={setInput}
              onPromptClick={sendMessage}
              onSubmit={handleSubmit}
              pendingImages={pendingImages}
              quickPrompts={quickPrompts}
              removeImages={() => setPendingImages([])}
              t={t}
            />
          ) : (
            <GuestChat
              countryCode={countryCode}
              locale={locale}
              supportBenefits={supportBenefits}
              t={t}
            />
          )}
        </aside>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-[#174b3d] text-white shadow-[0_12px_26px_rgba(17,49,39,0.28)] transition hover:bg-[#103a2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174b3d] focus-visible:ring-offset-2 active:scale-[0.96]"
        aria-label={t("chat.button_label")}
      >
        {isOpen ? <ChevronDownIcon /> : <ConversationIcon />}
      </button>
    </div>
  )
}

function GuestChat({
  countryCode,
  locale,
  supportBenefits,
  t,
}: {
  countryCode: string
  locale: string
  supportBenefits: string[]
  t: ReturnType<typeof useTranslation>
}) {
  return (
    <section className="flex flex-1 flex-col px-6 py-7 text-center small:px-7">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e7efe9] text-[#174b3d]">
        <StoreBagIcon />
      </div>
      <h2 className="mt-6 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[#12231d]">
        {t("chat.auth_required_title")}
      </h2>
      <p className="mx-auto mt-3 max-w-[290px] text-sm leading-6 text-[#60716a]">
        {t("chat.auth_required_desc")}
      </p>

      <ul className="mx-auto mt-7 w-full max-w-[310px] border-y border-[#12231d]/10 py-2 text-left">
        {supportBenefits.map((benefit) => (
          <li key={benefit} className="flex items-center gap-3 py-2.5 text-sm text-[#315248]">
            <CheckIcon />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <a
        href={`/${locale}/${countryCode}/account`}
        className="mt-auto inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#174b3d] px-5 text-sm font-semibold text-white transition hover:bg-[#103a2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174b3d] focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        {t("chat.sign_in_register")}
        <ArrowRightIcon />
      </a>
    </section>
  )
}

function AuthenticatedChat({
  countryCode,
  customerName,
  errorMessage,
  imageInputRef,
  input,
  isLoading,
  locale,
  messages,
  messagesEndRef,
  onImagesSelected,
  onInputChange,
  onPromptClick,
  onSubmit,
  pendingImages,
  quickPrompts,
  removeImages,
  t,
}: {
  countryCode: string
  customerName: string
  errorMessage: string | null
  imageInputRef: React.RefObject<HTMLInputElement | null>
  input: string
  isLoading: boolean
  locale: string
  messages: ReturnType<typeof useCustomerChat>["messages"]
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onImagesSelected: (event: ChangeEvent<HTMLInputElement>) => void
  onInputChange: (value: string) => void
  onPromptClick: (prompt: string) => void
  onSubmit: (event: FormEvent) => void
  pendingImages: File[]
  quickPrompts: string[]
  removeImages: () => void
  t: ReturnType<typeof useTranslation>
}) {
  return (
    <>
      <section aria-live="polite" className="flex-1 overflow-y-auto bg-[#f8faf8] px-4 py-5 small:px-5">
        {errorMessage && (
          <p role="alert" className="mb-4 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
            {errorMessage}
          </p>
        )}

        {messages.length === 0 ? (
          <div className="pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#60716a]">
              {t("chat.greeting", { name: customerName })}
            </p>
            <h2 className="mt-2 max-w-[260px] text-2xl font-semibold leading-tight tracking-[-0.045em] text-[#12231d]">
              {t("chat.welcome_message")}
            </h2>
            <div className="mt-8 border-t border-[#12231d]/10">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onPromptClick(prompt)}
                  className="group flex w-full items-center justify-between border-b border-[#12231d]/10 py-3.5 text-left text-sm font-medium text-[#315248] transition hover:text-[#174b3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174b3d]/35 focus-visible:ring-inset"
                >
                  <span>{prompt}</span>
                  <ArrowRightIcon className="text-[#8a9a91] transition-transform group-hover:translate-x-0.5 group-hover:text-[#174b3d]" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => {
              const isCustomer = message.sender_type === "customer"
              return (
                <article key={message.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[84%] flex-col ${isCustomer ? "items-end" : "items-start"}`}>
                    <div
                      className={`whitespace-pre-wrap rounded-[18px] px-3.5 py-3 text-sm leading-6 ${
                        isCustomer
                          ? "rounded-br-md bg-[#174b3d] text-white"
                          : "rounded-bl-md border border-[#12231d]/10 bg-white text-[#12231d]"
                      }`}
                    >
                      {message.body}
                    </div>
                    {message.image_attachments && message.image_attachments.length > 0 && (
                      <div className="mt-2 grid max-w-full grid-cols-3 gap-1.5">
                        {message.image_attachments.map((attachment) => (
                          <img
                            key={attachment.id}
                            src={attachment.url}
                            alt="Ảnh được gửi trong cuộc trò chuyện"
                            className="h-20 w-20 rounded-xl border border-[#12231d]/10 object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                    {message.product_media && message.product_media.length > 0 && (
                      <div className="mt-2 flex w-full flex-col gap-2">
                        {message.product_media.map((product) => (
                          <ProductPreviewCard
                            key={product.product_id}
                            countryCode={countryCode}
                            locale={locale}
                            product={product}
                            viewDetailsLabel={t("chat.view_product")}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {isLoading && (
          <div className="mt-5 flex items-center gap-2 text-xs text-[#60716a]">
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#174b3d] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#174b3d] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#174b3d]" />
            </span>
            {t("chat.typing")}
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      <form onSubmit={onSubmit} className="border-t border-[#12231d]/10 bg-white px-4 py-3.5 small:px-5">
        {pendingImages.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#60716a]">
            <span>{pendingImages.length} ảnh đã chọn</span>
            <button
              type="button"
              onClick={removeImages}
              className="font-semibold text-[#174b3d] underline decoration-[#174b3d]/35 underline-offset-4 transition hover:text-[#103a2f]"
            >
              Bỏ ảnh
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-full border border-[#12231d]/15 bg-[#f8faf8] p-1.5 transition focus-within:border-[#174b3d]/45 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#174b3d]/15">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={onImagesSelected}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#60716a] transition hover:bg-[#e7efe9] hover:text-[#174b3d] disabled:opacity-40"
            title="Gửi ảnh để cửa hàng kiểm tra"
            aria-label="Gửi ảnh để cửa hàng kiểm tra"
          >
            <ImageIcon />
          </button>
          <input
            type="text"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={t("chat.input_placeholder")}
            className="min-w-0 flex-1 bg-transparent px-1 text-sm text-[#12231d] outline-none placeholder:text-[#8a9a91]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#174b3d] text-white transition hover:bg-[#103a2f] disabled:opacity-35"
            title={t("chat.send")}
            aria-label={t("chat.send")}
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </>
  )
}

function ProductPreviewCard({
  countryCode,
  locale,
  product,
  viewDetailsLabel,
}: {
  countryCode: string
  locale: string
  product: ProductMediaItem
  viewDetailsLabel: string
}) {
  const productUrl = product.product_url || `/${locale}/${countryCode}/products/${product.product_id}`

  return (
    <a
      href={productUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-[#12231d]/10 bg-white p-2.5 text-left transition hover:border-[#174b3d]/35"
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.title}
          className="h-14 w-14 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#edf3ef] text-[#174b3d]">
          <StoreBagIcon />
        </div>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#12231d]">{product.title}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#174b3d]">
          {viewDetailsLabel}
          <ArrowRightIcon />
        </span>
      </span>
    </a>
  )
}

function StoreMark() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dfeae3] text-base font-semibold tracking-[-0.16em] text-[#174b3d]" aria-hidden="true">
      S
    </span>
  )
}

function Icon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <svg className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
}

function CloseIcon() {
  return <Icon><path strokeLinecap="round" d="m7 7 10 10M17 7 7 17" /></Icon>
}

function RefreshIcon() {
  return <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5A7.5 7.5 0 0 1 18 7.8M19.5 13.5A7.5 7.5 0 0 1 6 16.2M18 4.5v3.3h-3.3M6 19.5v-3.3h3.3" /></Icon>
}

function ConversationIcon() {
  return <Icon className="h-[25px] w-[25px]"><path strokeLinecap="round" strokeLinejoin="round" d="M19.25 11.25A7.25 7.25 0 0 1 8.1 17.4L4.75 19l1.08-3.08A7.25 7.25 0 1 1 19.25 11.25Z" /></Icon>
}

function ChevronDownIcon() {
  return <Icon className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></Icon>
}

function StoreBagIcon() {
  return <Icon className="h-7 w-7"><path strokeLinecap="round" strokeLinejoin="round" d="M6 8.5h12l.8 10.2a1.5 1.5 0 0 1-1.5 1.6H6.7a1.5 1.5 0 0 1-1.5-1.6L6 8.5ZM9 9V6.8a3 3 0 0 1 6 0V9" /></Icon>
}

function CheckIcon() {
  return <Icon className="h-4 w-4 shrink-0 text-[#174b3d]"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4.2 4L19 6.5" /></Icon>
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return <Icon className={`h-4 w-4 shrink-0 ${className}`}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-5-5 5 5-5 5" /></Icon>
}

function ImageIcon() {
  return <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.5-2.5v-11ZM8 15l2.7-2.7a1.4 1.4 0 0 1 2 0l1.5 1.5 1-1a1.4 1.4 0 0 1 2 0l1.8 1.8M9 8.5h.01" /></Icon>
}

function SendIcon() {
  return <Icon><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 5.2 15 6.1-15 6.5 2.2-5.4 5.3-1.1-5.3-1.1-2.2-5Z" /></Icon>
}
