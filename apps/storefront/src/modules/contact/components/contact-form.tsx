"use client"

import { useState } from "react"
import { Button } from "@modules/common/components/ui"
import { ExclamationCircleSolid, CheckCircleSolid } from "@medusajs/icons"

type ContactDictionary = {
  contact?: {
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
  checkout?: {
    enter_valid_email?: string
  }
}

type ContactFormProps = {
  dict: ContactDictionary
}

export default function ContactForm({ dict }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    topic: "",
    orderId: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errorMessage) setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setErrorMessage((dict.contact?.name_label || "Họ tên") + " không được để trống.")
      return
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      setErrorMessage(dict.checkout?.enter_valid_email || "Vui lòng nhập email hợp lệ.")
      return
    }

    if (!formData.message.trim()) {
      setErrorMessage((dict.contact?.message_label || "Nội dung") + " không được để trống.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    // Simulate API request processing
    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      const randomCode =
        "SYN-CT-" + Math.floor(100000 + Math.random() * 900000)
      setSubmittedTicket(randomCode)
      setFormData({
        name: "",
        email: "",
        phone: "",
        topic: "",
        orderId: "",
        message: "",
      })
    } catch {
      setErrorMessage("Đã xảy ra lỗi khi gửi yêu cầu. Vui lòng thử lại sau.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedTicket) {
    return (
      <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle p-6 md:p-8 text-center animate-in fade-in duration-300 shadow-borders-base">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ui-bg-base border border-ui-border-base text-ui-fg-base shadow-borders-base">
          <CheckCircleSolid className="text-ui-fg-interactive" />
        </div>
        <h3 className="text-xl font-bold text-ui-fg-base">
          {dict.contact?.success_title}
        </h3>
        <p className="mt-3 text-sm text-ui-fg-subtle leading-relaxed max-w-md mx-auto">
          {dict.contact?.success_desc?.replace("{ticket}", submittedTicket)}
        </p>
        <div className="mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSubmittedTicket(null)}
            className="text-sm font-medium"
          >
            {dict.contact?.send_another}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="rounded-lg border border-ui-border-error bg-ui-bg-error p-3.5 text-xs text-ui-fg-error flex items-center gap-2 shadow-borders-base">
          <ExclamationCircleSolid />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.contact?.name_label} <span className="text-ui-fg-error">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder={dict.contact?.name_placeholder}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.contact?.email_label} <span className="text-ui-fg-error">*</span>
          </label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder={dict.contact?.email_placeholder}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.contact?.phone_label}
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder={dict.contact?.phone_placeholder}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          />
        </div>

        {/* Order ID */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.contact?.order_id_label}
          </label>
          <input
            type="text"
            name="orderId"
            value={formData.orderId}
            onChange={handleChange}
            placeholder={dict.contact?.order_id_placeholder}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          />
        </div>
      </div>

      {/* Topic */}
      <div>
        <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
          {dict.contact?.topic_label}
        </label>
        <select
          name="topic"
          value={formData.topic}
          onChange={handleChange}
          className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
        >
          <option value="">{dict.contact?.topic_select}</option>
          <option value="product">{dict.contact?.topic_product}</option>
          <option value="order">{dict.contact?.topic_order}</option>
          <option value="returns">{dict.contact?.topic_returns}</option>
          <option value="feedback">{dict.contact?.topic_feedback}</option>
          <option value="other">{dict.contact?.topic_other}</option>
        </select>
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
          {dict.contact?.message_label} <span className="text-ui-fg-error">*</span>
        </label>
        <textarea
          name="message"
          rows={4}
          required
          value={formData.message}
          onChange={handleChange}
          placeholder={dict.contact?.message_placeholder}
          className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base resize-y"
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          className="w-full sm:w-auto px-8"
        >
          {isSubmitting ? dict.contact?.submitting : dict.contact?.submit_btn}
        </Button>
      </div>
    </form>
  )
}
