"use client"

import { useState } from "react"
import { Heading, Text } from "@modules/common/components/ui"
import {
  ArrowRightMini,
  ChatBubbleLeftRight,
  CheckCircleSolid,
  Clock,
  Phone,
  Tag,
  TruckFast,
  XCircleSolid,
} from "@medusajs/icons"
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

export default function ReturnsTemplate({ dict }: ReturnsTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
  const returns = dict.returns
  const faqs = returns?.faqs || []
  const policyCards = [
    {
      icon: Clock,
      title: returns?.policy_time_title,
      description: returns?.policy_time_desc,
    },
    {
      icon: Tag,
      title: returns?.policy_condition_title,
      description: returns?.policy_condition_desc,
    },
    {
      icon: TruckFast,
      title: returns?.policy_fee_title,
      description: returns?.policy_fee_desc,
    },
    {
      icon: XCircleSolid,
      title: returns?.policy_exceptions_title,
      description: returns?.policy_exceptions_desc,
    },
  ]
  const steps = [
    { title: returns?.step_1_title, description: returns?.step_1_desc },
    { title: returns?.step_2_title, description: returns?.step_2_desc },
    { title: returns?.step_3_title, description: returns?.step_3_desc },
    { title: returns?.step_4_title, description: returns?.step_4_desc },
  ]

  return (
    <main className="min-h-[calc(100vh-64px)] bg-ui-bg-subtle py-8 small:py-12">
      <div className="content-container mx-auto max-w-6xl space-y-10 sm:space-y-14">
        <section className="overflow-hidden rounded-2xl border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest">
          <div className="grid lg:grid-cols-[1.3fr_0.7fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <Heading
                level="h1"
                className="max-w-2xl text-3xl font-bold tracking-tight text-ui-fg-base sm:text-5xl"
              >
                {returns?.title}
              </Heading>
              <Text className="mt-5 max-w-xl text-base leading-relaxed text-ui-fg-subtle sm:text-lg">
                {returns?.subtitle}
              </Text>
              <a
                href="#return-request"
                className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md bg-ui-fg-base px-5 py-3 text-sm font-semibold text-ui-bg-base transition hover:bg-ui-fg-subtle focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2"
              >
                Gửi yêu cầu đổi trả <ArrowRightMini />
              </a>
            </div>
            <aside className="border-t border-ui-border-base bg-ui-bg-subtle p-7 lg:border-l lg:border-t-0 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
                Cam kết Synapse
              </p>
              <div className="mt-6 space-y-5">
                {[
                  "Xác nhận yêu cầu trong giờ làm việc",
                  "Hướng dẫn lấy hàng rõ ràng, không phát sinh mơ hồ",
                  "Theo dõi xuyên suốt đến khi đổi hàng hoặc hoàn tiền",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 text-sm leading-relaxed text-ui-fg-subtle"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ui-bg-base text-ui-fg-interactive shadow-borders-base">
                      <CheckCircleSolid className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
                Trước khi gửi yêu cầu
              </p>
              <Heading
                level="h2"
                className="mt-2 text-2xl font-bold text-ui-fg-base"
              >
                {returns?.policy_highlights_title}
              </Heading>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-ui-fg-subtle">
              Bốn điều quan trọng để quá trình kiểm tra và xử lý diễn ra nhanh
              hơn.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-ui-border-base bg-ui-border-base sm:grid-cols-2 lg:grid-cols-4">
            {policyCards.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title || index}
                className="min-h-56 bg-ui-bg-base p-6 sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ui-bg-subtle text-ui-fg-interactive">
                    <Icon />
                  </span>
                  <span className="text-xs font-semibold text-ui-fg-muted">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-base font-bold text-ui-fg-base">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ui-fg-subtle">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-elevation-card-rest sm:p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
            Minh bạch từng chặng
          </p>
          <Heading
            level="h2"
            className="mt-2 text-2xl font-bold text-ui-fg-base"
          >
            {returns?.steps_title}
          </Heading>
          <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.title || index}
                className="relative border-l-2 border-ui-border-base pl-5 lg:border-l-0 lg:border-t-2 lg:px-0 lg:pt-5"
              >
                <span className="absolute -left-[11px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-ui-fg-base text-[10px] font-bold text-ui-bg-base lg:left-0 lg:-top-[11px]">
                  {index + 1}
                </span>
                <h3 className="text-base font-bold text-ui-fg-base">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ui-fg-subtle">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="return-request"
          className="grid items-start gap-6 lg:grid-cols-[1.55fr_0.75fr]"
        >
          <div className="rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-elevation-card-rest sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
              Bắt đầu tại đây
            </p>
            <Heading
              level="h2"
              className="mt-2 text-2xl font-bold text-ui-fg-base"
            >
              {returns?.portal_title}
            </Heading>
            <Text className="mt-2 text-sm leading-relaxed text-ui-fg-subtle">
              {returns?.portal_desc}
            </Text>
            <div className="mt-7 border-t border-ui-border-base pt-7">
              <ReturnRequestForm dict={dict} />
            </div>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-2xl bg-ui-fg-base p-6 text-ui-bg-base shadow-elevation-card-rest">
              <ChatBubbleLeftRight className="h-6 w-6" />
              <h3 className="mt-7 text-xl font-bold">
                {returns?.need_instant_help}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ui-bg-subtle">
                Cần đổi size, kiểm tra sản phẩm hoặc muốn được hướng dẫn ngay?
                Trợ lý CSKH có thể hỗ trợ bạn trước khi gửi form.
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
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ui-bg-base px-4 py-2 text-sm font-semibold text-ui-fg-base transition hover:bg-ui-bg-subtle"
              >
                {returns?.chat_ai_now}
                <ArrowRightMini />
              </button>
            </div>
            <div className="rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-elevation-card-rest">
              <div className="flex items-center gap-2 text-sm font-bold text-ui-fg-base">
                <Phone className="text-ui-fg-interactive" /> Cần gặp nhân viên?
              </div>
              <p className="mt-4 text-sm text-ui-fg-subtle">
                Hotline <strong className="text-ui-fg-base">1900 6868</strong> ·
                08:30 – 22:00
              </p>
              <LocalizedClientLink
                href="/contact"
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ui-fg-base hover:text-ui-fg-subtle"
              >
                Xem tất cả kênh hỗ trợ <ArrowRightMini />
              </LocalizedClientLink>
            </div>
          </aside>
        </section>

        {faqs.length > 0 && (
          <section className="mx-auto max-w-4xl">
            <div className="mb-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
                Giải đáp nhanh
              </p>
              <Heading
                level="h2"
                className="mt-2 text-2xl font-bold text-ui-fg-base"
              >
                {returns?.faq_title}
              </Heading>
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
