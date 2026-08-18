"use client"

import { useState } from "react"
import { Heading, Text } from "@modules/common/components/ui"
import {
  ArrowRightMini,
  ArrowUturnLeft,
  BuildingsMini,
  ChatBubbleLeftRight,
  Envelope,
  MapPin,
  Phone,
} from "@medusajs/icons"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ContactForm from "../components/contact-form"

type ContactDictionary = {
  contact?: {
    title?: string
    subtitle?: string
    response_sla?: string
    ai_chat_title?: string
    ai_chat_desc?: string
    ai_chat_cta?: string
    hotline_title?: string
    hotline_number?: string
    hotline_desc?: string
    hotline_cta?: string
    email_title?: string
    email_address?: string
    email_desc?: string
    email_cta?: string
    store_title?: string
    store_hn?: string
    store_hcm?: string
    hours?: string
    form_title?: string
    form_desc?: string
    faq_title?: string
    faq_subtitle?: string
    faqs?: Array<{ q: string; a: string }>
    name_label?: string
    name_placeholder?: string
    email_label?: string
    email_placeholder?: string
    phone_label?: string
    phone_placeholder?: string
    order_id_label?: string
    order_id_placeholder?: string
    topic_label?: string
    topic_select?: string
    topic_product?: string
    topic_order?: string
    topic_returns?: string
    topic_feedback?: string
    topic_other?: string
    message_label?: string
    message_placeholder?: string
    submit_btn?: string
    submitting?: string
    success_title?: string
    success_desc?: string
    send_another?: string
  }
  footer?: { returns?: string }
  returns?: { title?: string; subtitle?: string }
  checkout?: { enter_valid_email?: string }
}

type ContactTemplateProps = {
  dict: ContactDictionary
  locale?: string
  countryCode?: string
}

export default function ContactTemplate({ dict }: ContactTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
  const contact = dict.contact
  const faqs = contact?.faqs || []
  const channels = [
    {
      icon: Phone,
      title: contact?.hotline_title,
      detail: contact?.hotline_number,
      description: contact?.hotline_desc,
      action: contact?.hotline_cta,
      href: `tel:${contact?.hotline_number?.replace(/\s/g, "")}`,
    },
    {
      icon: Envelope,
      title: contact?.email_title,
      detail: contact?.email_address,
      description: contact?.email_desc,
      action: contact?.email_cta,
      href: `mailto:${contact?.email_address}`,
    },
    {
      icon: BuildingsMini,
      title: contact?.store_title,
      detail: contact?.hours,
      description: contact?.store_hn,
      action: dict.footer?.returns || "Đổi trả hàng",
      href: "/returns",
    },
  ]

  return (
    <main className="min-h-[calc(100vh-64px)] bg-ui-bg-subtle py-8 small:py-12">
      <div className="content-container mx-auto max-w-6xl space-y-10 sm:space-y-14">
        <section className="grid overflow-hidden rounded-2xl border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <Heading
              level="h1"
              className="max-w-2xl text-3xl font-bold tracking-tight text-ui-fg-base sm:text-5xl"
            >
              {contact?.title}
            </Heading>
            <Text className="mt-5 max-w-xl text-base leading-relaxed text-ui-fg-subtle sm:text-lg">
              {contact?.subtitle}
            </Text>
            <a
              href="#contact-form"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md bg-ui-fg-base px-5 py-3 text-sm font-semibold text-ui-bg-base transition hover:bg-ui-fg-subtle focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2"
            >
              Gửi tin nhắn <ArrowRightMini />
            </a>
          </div>
          <div className="bg-ui-fg-base p-7 text-ui-bg-base sm:p-10 lg:p-12">
            <ChatBubbleLeftRight className="h-7 w-7" />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-ui-bg-subtle">
              Nhanh nhất lúc này
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {contact?.ai_chat_title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ui-bg-subtle">
              {contact?.ai_chat_desc}
            </p>
            <button
              type="button"
              onClick={() =>
                (
                  document.querySelector(
                    'button[aria-label*="Chat"]'
                  ) as HTMLButtonElement | null
                )?.click()
              }
              className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ui-bg-base px-4 py-2 text-sm font-semibold text-ui-fg-base transition hover:bg-ui-bg-subtle"
            >
              {contact?.ai_chat_cta}
              <ArrowRightMini />
            </button>
          </div>
        </section>

        <section>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
              Chọn cách bạn muốn liên hệ
            </p>
            <Heading
              level="h2"
              className="mt-2 text-2xl font-bold text-ui-fg-base"
            >
              Luôn có người sẵn sàng hỗ trợ
            </Heading>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-ui-border-base bg-ui-border-base md:grid-cols-3">
            {channels.map(
              ({ icon: Icon, title, detail, description, action, href }) => (
                <article
                  key={title}
                  className="flex min-h-64 flex-col bg-ui-bg-base p-6 sm:p-7"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ui-bg-subtle text-ui-fg-interactive">
                    <Icon />
                  </span>
                  <h3 className="mt-7 text-base font-bold text-ui-fg-base">
                    {title}
                  </h3>
                  <p className="mt-2 text-lg font-bold text-ui-fg-base">
                    {detail}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ui-fg-subtle">
                    {description}
                  </p>
                  <a
                    href={href}
                    className="mt-auto inline-flex min-h-11 items-end gap-2 pt-5 text-sm font-semibold text-ui-fg-base hover:text-ui-fg-subtle"
                  >
                    {action}
                    <ArrowRightMini />
                  </a>
                </article>
              )
            )}
          </div>
        </section>

        <section
          className="grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]"
          id="contact-form"
        >
          <div className="rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-elevation-card-rest sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
              Để lại thông tin
            </p>
            <Heading
              level="h2"
              className="mt-2 text-2xl font-bold text-ui-fg-base"
            >
              {contact?.form_title}
            </Heading>
            <Text className="mt-2 text-sm leading-relaxed text-ui-fg-subtle">
              {contact?.form_desc}
            </Text>
            <div className="mt-7 border-t border-ui-border-base pt-7">
              <ContactForm dict={dict} />
            </div>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-elevation-card-rest">
              <div className="flex items-center gap-2 text-base font-bold text-ui-fg-base">
                <MapPin className="text-ui-fg-interactive" />
                {contact?.store_title}
              </div>
              <div className="mt-6 space-y-6 text-sm leading-relaxed text-ui-fg-subtle">
                <div>
                  <h3 className="font-bold text-ui-fg-base">
                    Chi nhánh Hà Nội
                  </h3>
                  <p className="mt-1">{contact?.store_hn}</p>
                  <p className="mt-2 font-medium text-ui-fg-base">
                    {contact?.hours}
                  </p>
                </div>
                <div className="border-t border-ui-border-base pt-5">
                  <h3 className="font-bold text-ui-fg-base">
                    Chi nhánh TP. Hồ Chí Minh
                  </h3>
                  <p className="mt-1">{contact?.store_hcm}</p>
                  <p className="mt-2 font-medium text-ui-fg-base">
                    {contact?.hours}
                  </p>
                </div>
              </div>
            </div>
            <LocalizedClientLink
              href="/returns"
              className="block rounded-2xl border border-ui-border-base bg-ui-bg-subtle p-6 shadow-borders-base transition hover:bg-ui-bg-base"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-ui-fg-base">
                <ArrowUturnLeft className="text-ui-fg-interactive" />
                {dict.returns?.title || "Đổi trả trong 7 ngày"}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ui-fg-subtle">
                {dict.returns?.subtitle ||
                  "Gửi yêu cầu đổi trả và theo dõi quy trình rõ ràng."}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ui-fg-base">
                Xem chính sách <ArrowRightMini />
              </span>
            </LocalizedClientLink>
          </aside>
        </section>

        {faqs.length > 0 && (
          <section className="mx-auto max-w-4xl">
            <div className="mb-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
                Có thể bạn đang cần
              </p>
              <Heading
                level="h2"
                className="mt-2 text-2xl font-bold text-ui-fg-base"
              >
                {contact?.faq_title}
              </Heading>
              {contact?.faq_subtitle && (
                <Text className="mt-2 text-sm text-ui-fg-subtle">
                  {contact.faq_subtitle}
                </Text>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div
                    key={faq.q}
                    className="border-b border-ui-border-base last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ui-fg-base hover:bg-ui-bg-subtle sm:px-6"
                    >
                      <span>{faq.q}</span>
                      <span className="text-lg font-normal text-ui-fg-muted">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm leading-relaxed text-ui-fg-subtle sm:px-6">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
