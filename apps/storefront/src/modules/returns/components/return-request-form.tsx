"use client"

import { useState } from "react"
import { Button } from "@modules/common/components/ui"
import { CheckCircleSolid, InformationCircleSolid, ChatBubbleLeftRight, ExclamationCircleSolid, LockClosedSolidMini } from "@medusajs/icons"

type ReturnsDictionary = {
  returns?: {
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
  }
}

type ReturnRequestFormProps = {
  dict: ReturnsDictionary
}

export default function ReturnRequestForm({ dict }: ReturnRequestFormProps) {
  const [formData, setFormData] = useState({
    orderId: "",
    customerName: "",
    contactInfo: "",
    reason: "",
    exchangeTarget: "",
    notes: "",
    pickupAddress: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedRma, setSubmittedRma] = useState<string | null>(null)
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

    if (!formData.orderId.trim()) {
      setErrorMessage((dict.returns?.order_id_label || "Mã đơn hàng") + " không được để trống.")
      return
    }

    if (!formData.customerName.trim()) {
      setErrorMessage((dict.returns?.customer_name_label || "Họ tên") + " không được để trống.")
      return
    }

    if (!formData.contactInfo.trim()) {
      setErrorMessage((dict.returns?.contact_info_label || "Thông tin liên hệ") + " không được để trống.")
      return
    }

    if (!formData.reason) {
      setErrorMessage((dict.returns?.reason_label || "Lý do đổi trả") + " không được để trống.")
      return
    }

    if (!formData.pickupAddress.trim()) {
      setErrorMessage((dict.returns?.pickup_address_label || "Địa chỉ lấy hàng") + " không được để trống.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 900))
      const generatedRma =
        "RMA-VN-" + Math.floor(100000 + Math.random() * 900000)
      setSubmittedRma(generatedRma)
      setFormData({
        orderId: "",
        customerName: "",
        contactInfo: "",
        reason: "",
        exchangeTarget: "",
        notes: "",
        pickupAddress: "",
      })
    } catch {
      setErrorMessage("Đã xảy ra lỗi khi tạo yêu cầu. Vui lòng thử lại sau.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedRma) {
    return (
      <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle p-6 md:p-8 text-center animate-in fade-in duration-300 shadow-borders-base">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ui-bg-base border border-ui-border-base text-ui-fg-base shadow-borders-base">
          <CheckCircleSolid className="text-ui-fg-interactive" />
        </div>
        <h3 className="text-xl font-bold text-ui-fg-base">
          {dict.returns?.success_title}
        </h3>
        <p className="mt-3 text-sm text-ui-fg-subtle leading-relaxed max-w-lg mx-auto">
          {dict.returns?.success_desc?.replace("{rmaCode}", submittedRma)}
        </p>

        <div className="mt-5 max-w-md mx-auto rounded-lg border border-ui-border-base bg-ui-bg-base p-4 text-xs text-left text-ui-fg-subtle space-y-2 shadow-borders-base">
          <div className="font-semibold text-ui-fg-base">
            <InformationCircleSolid className="text-ui-fg-subtle inline-block mr-1" /> Hướng dẫn bước tiếp theo:
          </div>
          <div>1. Đóng gói sản phẩm nguyên tem mác kèm phụ kiện ban đầu.</div>
          <div>2. Shipper sẽ liên hệ trước khi đến nhận gói hàng tại địa chỉ của bạn.</div>
          <div>3. Bạn không phải thanh toán thêm bất kỳ phí vận chuyển nào cho shipper.</div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSubmittedRma(null)}
            className="text-sm font-medium"
          >
            Tạo yêu cầu đổi trả khác
          </Button>
          <button
            type="button"
            onClick={() => {
              const chatBtn = document.querySelector(
                'button[aria-label*="Chat"]'
              ) as HTMLButtonElement
              if (chatBtn) chatBtn.click()
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-ui-border-base bg-ui-bg-base px-4 py-2 text-xs font-semibold text-ui-fg-base hover:bg-ui-bg-subtle transition shadow-borders-base"
          >
            <div className="flex items-center gap-2"><ChatBubbleLeftRight /> <span>Chat với CSKH để hỗ trợ lấy hàng ngay</span></div>
          </button>
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
        {/* Order ID */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.returns?.order_id_label} <span className="text-ui-fg-error">*</span>
          </label>
          <input
            type="text"
            name="orderId"
            required
            value={formData.orderId}
            onChange={handleChange}
            placeholder={dict.returns?.order_id_placeholder}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          />
        </div>

        {/* Customer Name */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.returns?.customer_name_label} <span className="text-ui-fg-error">*</span>
          </label>
          <input
            type="text"
            name="customerName"
            required
            value={formData.customerName}
            onChange={handleChange}
            placeholder={dict.returns?.customer_name_placeholder}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contact Info (Email or Phone) */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.returns?.contact_info_label} <span className="text-ui-fg-error">*</span>
          </label>
          <input
            type="text"
            name="contactInfo"
            required
            value={formData.contactInfo}
            onChange={handleChange}
            placeholder={dict.returns?.contact_info_placeholder}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          />
        </div>

        {/* Reason for return */}
        <div>
          <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
            {dict.returns?.reason_label} <span className="text-ui-fg-error">*</span>
          </label>
          <select
            name="reason"
            required
            value={formData.reason}
            onChange={handleChange}
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
          >
            <option value="">{dict.returns?.reason_select}</option>
            <option value="size">{dict.returns?.reason_size}</option>
            <option value="color">{dict.returns?.reason_color}</option>
            <option value="defect">{dict.returns?.reason_defect}</option>
            <option value="wrong_item">{dict.returns?.reason_wrong_item}</option>
            <option value="not_satisfied">{dict.returns?.reason_not_satisfied}</option>
          </select>
        </div>
      </div>

      {/* Target Item for exchange */}
      <div>
        <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
          {dict.returns?.exchange_target_label}
        </label>
        <input
          type="text"
          name="exchangeTarget"
          value={formData.exchangeTarget}
          onChange={handleChange}
          placeholder={dict.returns?.exchange_target_placeholder}
          className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
        />
      </div>

      {/* Pickup Address */}
      <div>
        <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
          {dict.returns?.pickup_address_label} <span className="text-ui-fg-error">*</span>
        </label>
        <input
          type="text"
          name="pickupAddress"
          required
          value={formData.pickupAddress}
          onChange={handleChange}
          placeholder={dict.returns?.pickup_address_placeholder}
          className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base"
        />
      </div>

      {/* Detailed Notes */}
      <div>
        <label className="block text-xs font-semibold text-ui-fg-base mb-1.5">
          {dict.returns?.notes_label}
        </label>
        <textarea
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          placeholder={dict.returns?.notes_placeholder}
          className="w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive focus:ring-offset-2 transition shadow-borders-base resize-y"
        />
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          className="w-full sm:w-auto px-8"
        >
          {isSubmitting ? dict.returns?.submitting : dict.returns?.submit_btn}
        </Button>

        <div className="text-xs text-ui-fg-muted flex items-center gap-1.5">
          <LockClosedSolidMini />
          <span>Thông tin được bảo mật và xử lý tự động theo quy trình CSKH</span>
        </div>
      </div>
    </form>
  )
}
