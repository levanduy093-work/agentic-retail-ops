"use client"

import { useState } from "react"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ReturnRequestForm from "../components/return-request-form"

type ReturnsDictionary = {
  returns?: {
    title?: string
    subtitle?: string
    policy_highlights_title?: string
    policy_time_title?: string
    policy_time_desc?: string
    policy_condition_title?: string
    policy_condition_desc?: string
    policy_fee_title?: string
    policy_fee_desc?: string
    policy_exceptions_title?: string
    policy_exceptions_desc?: string
    steps_title?: string
    step_1_title?: string
    step_1_desc?: string
    step_2_title?: string
    step_2_desc?: string
    step_3_title?: string
    step_3_desc?: string
    step_4_title?: string
    step_4_desc?: string
    portal_title?: string
    portal_desc?: string
    order_id_label?: string
    order_id_placeholder?: string
    customer_name_label?: string
    customer_name_placeholder?: string
    contact_info_label?: string
    contact_info_placeholder?: string
    reason_label?: string
    reason_select?: string
    reason_size?: string
    reason_color?: string
    reason_defect?: string
    reason_wrong_item?: string
    reason_not_satisfied?: string
    exchange_target_label?: string
    exchange_target_placeholder?: string
    pickup_address_label?: string
    pickup_address_placeholder?: string
    notes_label?: string
    notes_placeholder?: string
    submit_btn?: string
    submitting?: string
    success_title?: string
    success_desc?: string
    need_instant_help?: string
    chat_ai_now?: string
    faq_title?: string
    faqs?: Array<{ q: string; a: string }>
  }
}

type ReturnsTemplateProps = {
  dict: ReturnsDictionary
  locale?: string
  countryCode?: string
}

export default function ReturnsTemplate({
  dict,
  locale: _locale,
  countryCode: _countryCode,
}: ReturnsTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  const faqs = dict.returns?.faqs || []

  return (
    <div className="py-8 small:py-14 min-h-[calc(100vh-64px)] bg-[#f8faf9]">
      <div className="content-container max-w-6xl mx-auto space-y-12">
        {/* 1. Header & Hero */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-[#174b3d]">
            <span>✨</span>
            <span>{dict.returns?.policy_time_title || "Đổi hàng trong 7 ngày"}</span>
          </div>

          <Heading
            level="h1"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-[#12231d]"
          >
            {dict.returns?.title}
          </Heading>

          <Text className="text-base text-gray-600 leading-relaxed">
            {dict.returns?.subtitle}
          </Text>
        </div>

        {/* 2. Four Policy Highlights Cards */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">
              {dict.returns?.policy_highlights_title}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 7-Day Window */}
            <div className="rounded-2xl border border-[#d2ded8] bg-white p-5 shadow-sm space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-700">
                ⏱️
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                {dict.returns?.policy_time_title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.policy_time_desc}
              </p>
            </div>

            {/* Product Condition */}
            <div className="rounded-2xl border border-[#d2ded8] bg-white p-5 shadow-sm space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
                🏷️
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                {dict.returns?.policy_condition_title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.policy_condition_desc}
              </p>
            </div>

            {/* Fee Policy */}
            <div className="rounded-2xl border border-[#d2ded8] bg-white p-5 shadow-sm space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-700">
                🚚
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                {dict.returns?.policy_fee_title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.policy_fee_desc}
              </p>
            </div>

            {/* Exceptions */}
            <div className="rounded-2xl border border-[#d2ded8] bg-white p-5 shadow-sm space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-xl text-purple-700">
                🚫
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                {dict.returns?.policy_exceptions_title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.policy_exceptions_desc}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Four Step Visualizer */}
        <div className="rounded-3xl border border-[#d2ded8] bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-gray-900">
              {dict.returns?.steps_title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="relative flex flex-col items-center text-center space-y-2 p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#174b3d] text-white font-bold text-sm shadow">
                1
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                {dict.returns?.step_1_title}
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.step_1_desc}
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative flex flex-col items-center text-center space-y-2 p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#174b3d] text-white font-bold text-sm shadow">
                2
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                {dict.returns?.step_2_title}
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.step_2_desc}
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative flex flex-col items-center text-center space-y-2 p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#174b3d] text-white font-bold text-sm shadow">
                3
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                {dict.returns?.step_3_title}
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.step_3_desc}
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative flex flex-col items-center text-center space-y-2 p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#174b3d] text-white font-bold text-sm shadow">
                4
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                {dict.returns?.step_4_title}
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                {dict.returns?.step_4_desc}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Interactive Return Portal Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Portal Form */}
          <div className="lg:col-span-8 rounded-3xl border border-[#d2ded8] bg-white p-6 sm:p-8 shadow-sm">
            <div className="mb-6 space-y-1">
              <Heading level="h2" className="text-xl font-bold text-gray-900">
                {dict.returns?.portal_title}
              </Heading>
              <Text className="text-xs text-gray-500">
                {dict.returns?.portal_desc}
              </Text>
            </div>
            <ReturnRequestForm dict={dict} />
          </div>

          {/* Side Callout: Instant AI Advice */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 p-6 shadow-sm space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white shadow-md">
                🤖
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900">
                  {dict.returns?.need_instant_help}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Trợ lý CSKH AI có thể kiểm tra tồn kho các size khác ngay lập tức và hỗ trợ bạn tạo đơn đổi size trong tích tắc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const chatBtn = document.querySelector(
                    'button[aria-label*="Chat"]'
                  ) as HTMLButtonElement
                  if (chatBtn) chatBtn.click()
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
              >
                <span>{dict.returns?.chat_ai_now}</span>
                <span>→</span>
              </button>
            </div>

            <div className="rounded-3xl border border-[#d2ded8] bg-white p-6 shadow-sm space-y-3 text-xs text-gray-600">
              <div className="font-bold text-gray-900 text-sm">
                📞 Cần gặp trực tiếp nhân viên?
              </div>
              <p>
                Hotline: <strong className="text-[#174b3d]">1900 6868</strong> (08:30 - 22:00)
              </p>
              <p>
                Email tiếp nhận: <strong className="text-[#174b3d]">support@synapse.vn</strong>
              </p>
              <div className="pt-2 border-t border-gray-100">
                <LocalizedClientLink
                  href="/contact"
                  className="inline-flex items-center gap-1 font-semibold text-[#174b3d] hover:underline"
                >
                  <span>Xem thêm các kênh hỗ trợ</span>
                  <span>→</span>
                </LocalizedClientLink>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Return FAQ Section */}
        {faqs.length > 0 && (
          <div className="rounded-3xl border border-[#d2ded8] bg-white p-6 sm:p-10 shadow-sm space-y-6">
            <div className="text-center space-y-1 max-w-xl mx-auto mb-6">
              <Heading level="h2" className="text-2xl font-bold text-gray-900">
                {dict.returns?.faq_title}
              </Heading>
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
