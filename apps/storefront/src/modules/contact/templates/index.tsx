"use client"

import { useState } from "react"
import { Heading, Text } from "@modules/common/components/ui"
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
  footer?: {
    returns?: string
  }
  returns?: {
    title?: string
    subtitle?: string
  }
  checkout?: {
    enter_valid_email?: string
  }
}

type ContactTemplateProps = {
  dict: ContactDictionary
  locale?: string
  countryCode?: string
}

export default function ContactTemplate({
  dict,
  locale: _locale,
  countryCode: _countryCode,
}: ContactTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  const faqs = dict.contact?.faqs || []

  return (
    <div className="py-8 small:py-14 min-h-[calc(100vh-64px)] bg-[#f8faf9]">
      <div className="content-container max-w-6xl mx-auto space-y-12">
        {/* 1. Header & Hero */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-[#174b3d]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            <span>{dict.contact?.response_sla || "Cam kết phản hồi nhanh"}</span>
          </div>

          <Heading
            level="h1"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-[#12231d]"
          >
            {dict.contact?.title}
          </Heading>

          <Text className="text-base text-gray-600 leading-relaxed">
            {dict.contact?.subtitle}
          </Text>
        </div>

        {/* 2. Omnichannel Support Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* AI CSKH */}
          <div className="rounded-2xl border border-[#d2ded8] bg-white p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-100 text-2xl">
                🤖
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {dict.contact?.ai_chat_title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.contact?.ai_chat_desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  const chatBtn = document.querySelector(
                    'button[aria-label*="Chat"]'
                  ) as HTMLButtonElement
                  if (chatBtn) chatBtn.click()
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <span>{dict.contact?.ai_chat_cta}</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Hotline */}
          <div className="rounded-2xl border border-[#d2ded8] bg-white p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-50 to-green-100 text-2xl">
                📞
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {dict.contact?.hotline_title}
              </h3>
              <div className="text-lg font-bold text-[#174b3d]">
                {dict.contact?.hotline_number}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.contact?.hotline_desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100">
              <a
                href={`tel:${dict.contact?.hotline_number?.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#174b3d] hover:text-[#103a2f] transition"
              >
                <span>{dict.contact?.hotline_cta}</span>
                <span>→</span>
              </a>
            </div>
          </div>

          {/* Email */}
          <div className="rounded-2xl border border-[#d2ded8] bg-white p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-50 to-pink-100 text-2xl">
                ✉️
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {dict.contact?.email_title}
              </h3>
              <div className="text-sm font-semibold text-[#174b3d] break-all">
                {dict.contact?.email_address}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.contact?.email_desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100">
              <a
                href={`mailto:${dict.contact?.email_address}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#174b3d] hover:text-[#103a2f] transition"
              >
                <span>{dict.contact?.email_cta}</span>
                <span>→</span>
              </a>
            </div>
          </div>

          {/* Showroom */}
          <div className="rounded-2xl border border-[#d2ded8] bg-white p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-50 to-orange-100 text-2xl">
                🏬
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {dict.contact?.store_title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.contact?.hours}
              </p>
              <p className="text-[11px] text-gray-500 line-clamp-2">
                {dict.contact?.store_hn}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100">
              <LocalizedClientLink
                href="/returns"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#174b3d] hover:text-[#103a2f] transition"
              >
                <span>{dict.footer?.returns || "Đổi trả hàng"}</span>
                <span>→</span>
              </LocalizedClientLink>
            </div>
          </div>
        </div>

        {/* 3. Main Two-Column Layout: Form & Showroom Directory */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Contact Form Column */}
          <div className="lg:col-span-7 rounded-3xl border border-[#d2ded8] bg-white p-6 sm:p-8 shadow-sm">
            <div className="mb-6 space-y-1">
              <Heading level="h2" className="text-xl font-bold text-gray-900">
                {dict.contact?.form_title}
              </Heading>
              <Text className="text-xs text-gray-500">
                {dict.contact?.form_desc}
              </Text>
            </div>
            <ContactForm dict={dict} />
          </div>

          {/* Showroom & Info Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border border-[#d2ded8] bg-white p-6 sm:p-7 shadow-sm space-y-5">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>📍</span>
                <span>{dict.contact?.store_title}</span>
              </h3>

              <div className="space-y-4 text-xs text-gray-600 divide-y divide-gray-100">
                <div className="pt-2 space-y-1">
                  <div className="font-semibold text-gray-900">
                    Chi nhánh Hà Nội
                  </div>
                  <p>{dict.contact?.store_hn}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    {dict.contact?.hours}
                  </p>
                </div>

                <div className="pt-4 space-y-1">
                  <div className="font-semibold text-gray-900">
                    Chi nhánh TP. Hồ Chí Minh
                  </div>
                  <p>{dict.contact?.store_hcm}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    {dict.contact?.hours}
                  </p>
                </div>
              </div>

              {/* Returns Quick Card */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                <div className="text-xs font-bold text-[#174b3d] flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>{dict.returns?.title || "Chính sách đổi trả 7 ngày"}</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {dict.returns?.subtitle ||
                    "Đổi trả hàng dễ dàng trong vòng 7 ngày kể từ khi nhận sản phẩm."}
                </p>
                <div className="pt-1">
                  <LocalizedClientLink
                    href="/returns"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#174b3d] hover:underline"
                  >
                    <span>Xem chính sách & gửi yêu cầu đổi hàng</span>
                    <span>→</span>
                  </LocalizedClientLink>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. FAQ Section */}
        {faqs.length > 0 && (
          <div className="rounded-3xl border border-[#d2ded8] bg-white p-6 sm:p-10 shadow-sm space-y-6">
            <div className="text-center space-y-1 max-w-xl mx-auto mb-6">
              <Heading level="h2" className="text-2xl font-bold text-gray-900">
                {dict.contact?.faq_title}
              </Heading>
              <Text className="text-xs text-gray-500">
                {dict.contact?.faq_subtitle}
              </Text>
            </div>

            <div className="divide-y divide-gray-200 max-w-3xl mx-auto">
              {faqs.map((faq: { q: string; a: string }, idx: number) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div key={idx} className="py-4">
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-900 hover:text-[#174b3d] transition"
                    >
                      <span>{faq.q}</span>
                      <span className="ml-4 text-gray-400 text-base font-normal">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-2.5 text-xs text-gray-600 leading-relaxed animate-in fade-in duration-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
