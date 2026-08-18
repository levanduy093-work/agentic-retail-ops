"use client"

import { Button, Heading, Text } from "@modules/common/components/ui"
import { isStripeLike, paymentInfoMap } from "@lib/constants"
import Divider from "@modules/common/components/divider"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "@lib/i18n/client"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { CheckCircleSolid, Clock, CreditCard, InformationCircleSolid } from "@medusajs/icons"
import React, { useEffect, useMemo, useState } from "react"
import { checkPayosPaymentStatus } from "@lib/data/payment"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const t = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useParams<{ locale?: string }>()
  const isVi = locale === "vi"

  const payment = order.payment_collections?.[0]?.payments?.[0]
  const isPaid = order.payment_status === "captured" || Boolean(payment?.captured_at)
  
  const paymentDate = payment?.created_at
    ? new Intl.DateTimeFormat(isVi ? "vi-VN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(payment.created_at))
    : null

  const getProviderTitle = (providerId?: string) => {
    if (!providerId) return isVi ? "Chuyển khoản VietQR PayOS" : "VietQR PayOS"
    if (providerId === "pp_system_default") {
      return t("checkout.manual_payment") || "Manual Payment"
    }
    if (isStripeLike(providerId)) {
      return t("checkout.credit_card") || "Credit card"
    }
    return paymentInfoMap[providerId]?.title || providerId
  }

  const paymentTitle = getProviderTitle(payment?.provider_id)
  const paymentIcon = payment
    ? paymentInfoMap[payment.provider_id]?.icon ?? <CreditCard />
    : <CreditCard />

  // PayOS Session Data & Modal State
  const sessionData = ((payment?.data || {}) as Record<string, unknown>)
  const qrCode = sessionData.qrCode as string | undefined
  const accountNumber = sessionData.accountNumber as string | undefined
  const accountName = sessionData.accountName as string | undefined
  const amount = (sessionData.amount as number | undefined) || payment?.amount || order.total
  const description = (sessionData.description as string | undefined) || `DH${order.display_id}`
  const bin = (sessionData.bin as string | undefined) || "970422"
  const orderCode = sessionData.orderCode as number | string | undefined

  const [showModal, setShowModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [modalPaidSuccess, setModalPaidSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Auto open modal if ?pay=true is in URL and unpaid
  useEffect(() => {
    if (searchParams?.get("pay") === "true" && !isPaid) {
      setShowModal(true)
    }
  }, [searchParams, isPaid])

  const qrImageSrc = useMemo(() => {
    if (
      qrCode?.startsWith("http://") ||
      qrCode?.startsWith("https://") ||
      qrCode?.startsWith("data:image")
    ) {
      return qrCode
    }
    if (bin && accountNumber) {
      const encodedName = encodeURIComponent(accountName || "")
      const encodedDesc = encodeURIComponent(description || "")
      return `https://img.vietqr.io/image/${bin}-${accountNumber}-compact2.png?amount=${
        amount || 0
      }&addInfo=${encodedDesc}&accountName=${encodedName}`
    }
    if (qrCode) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        qrCode
      )}`
    }
    return undefined
  }, [qrCode, bin, accountNumber, accountName, amount, description])

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleVerifyPayment = async () => {
    if (checkingPayment) return
    setCheckingPayment(true)
    setErrorMessage(null)

    try {
      if (orderCode) {
        const res = await checkPayosPaymentStatus(orderCode)
        if (res?.is_paid) {
          setModalPaidSuccess(true)
          setTimeout(() => {
            setShowModal(false)
            router.refresh()
          }, 1500)
          return
        } else {
          setErrorMessage(
            isVi
              ? "Hệ thống chưa ghi nhận tiền chuyển khoản cho đơn hàng này. Vui lòng quét mã QR hoặc chuyển khoản chính xác nội dung, sau đó nhấn kiểm tra lại."
              : "Payment not detected yet. Please ensure you have completed the bank transfer with the exact transfer memo, then try again."
          )
          return
        }
      }
      // If no orderCode to check against PayOS
      setErrorMessage(
        isVi
          ? "Đang chờ đối soát giao dịch ngân hàng. Vui lòng kiểm tra lại sau ít phút."
          : "Waiting for bank reconciliation. Please check back shortly."
      )
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setCheckingPayment(false)
    }
  }

  // Real-time Polling when modal is open
  useEffect(() => {
    if (!showModal || !orderCode || isPaid || modalPaidSuccess || checkingPayment) {
      return
    }

    let isSubscribed = true
    const interval = setInterval(async () => {
      try {
        const res = await checkPayosPaymentStatus(orderCode)
        if (isSubscribed && res?.is_paid) {
          setModalPaidSuccess(true)
          setTimeout(() => {
            setShowModal(false)
            router.refresh()
          }, 1500)
        }
      } catch {
        // Silently continue polling
      }
    }, 3000)

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [showModal, orderCode, isPaid, modalPaidSuccess, checkingPayment, router])

  return (
    <div>
      <Heading level="h2" className="flex flex-row text-3xl-regular my-6">
        {t("checkout.payment")}
      </Heading>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-5 sm:p-6 shadow-xs">
        {/* Cột 1: Phương thức thanh toán */}
        <div className="flex flex-col justify-start">
          <Text className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted mb-3">
            {t("checkout.payment_method")}
          </Text>
          <div className="flex h-11 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-neutral-200/90 text-[#174b3d] shadow-xs">
              {paymentIcon}
            </div>
            <div className="flex flex-col">
              <Text
                className="text-sm font-semibold text-ui-fg-base leading-snug"
                data-testid="payment-method"
              >
                {paymentTitle}
              </Text>
              {payment && isStripeLike(payment.provider_id) && payment.data?.card_last4 ? (
                <Text className="text-xs text-ui-fg-subtle mt-0.5 font-mono">
                  •••• •••• •••• {String(payment.data.card_last4)}
                </Text>
              ) : null}
            </div>
          </div>
        </div>

        {/* Cột 2: Chi tiết thanh toán */}
        <div className="flex flex-col justify-start border-t border-neutral-200/70 pt-4 md:border-t-0 md:border-l md:border-neutral-200/80 md:pt-0 md:pl-6">
          <Text className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted mb-3">
            {t("checkout.payment_details")}
          </Text>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Text
                className="text-lg font-bold text-ui-fg-base"
                data-testid="payment-amount"
              >
                {convertToLocale({
                  amount: payment?.amount || order.total,
                  currency_code: order.currency_code,
                })}
              </Text>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200/80" : "bg-amber-50 text-amber-700 border-amber-200/80"}`}>
                {isPaid ? (
                  <CheckCircleSolid className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                )}
                {isPaid ? (isVi ? "Đã thanh toán" : "Paid") : (isVi ? "Chưa thanh toán" : "Pending Payment")}
              </span>
            </div>

            {paymentDate && (
              <div className="flex items-center gap-1.5 text-xs text-ui-fg-muted">
                <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>
                  {isPaid ? t("order.paid_at") : t("order.payment_created_at")} {paymentDate}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unpaid Order Alert & Continue Payment CTA */}
      {!isPaid && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <InformationCircleSolid className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-900">
                {isVi ? "Đơn hàng chưa hoàn tất thanh toán" : "Payment Incomplete"}
              </span>
              <span className="text-xs text-amber-700 mt-0.5">
                {t("order.unpaid_order_alert")}
              </span>
            </div>
          </div>
          <Button
            onClick={() => {
              setErrorMessage(null)
              setShowModal(true)
            }}
            className="w-full sm:w-auto shrink-0 rounded-full bg-[#174b3d] hover:bg-[#103a2f] text-white px-5 py-2.5 text-xs font-semibold shadow-xs transition"
          >
            {isVi ? "Thanh toán ngay qua VietQR" : "Pay Now with VietQR"}
          </Button>
        </div>
      )}

      {/* VietQR Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] animate-fadeIn">
          <div className="relative w-full max-w-[400px] overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-neutral-200/80 transition-all">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 tracking-tight">
                  {isVi ? `Thanh toán đơn hàng #${order.display_id}` : `Pay Order #${order.display_id}`}
                </h3>
                {amount && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isVi ? "Số tiền:" : "Amount:"}{" "}
                    <span className="font-semibold text-neutral-900">
                      {new Intl.NumberFormat("vi-VN").format(amount)} ₫
                    </span>
                  </p>
                )}
              </div>
              {!modalPaidSuccess && (
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Success State Overlay */}
            {modalPaidSuccess ? (
              <div className="py-10 flex flex-col items-center justify-center text-center animate-fadeIn">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-[#174b3d] shadow-xs">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h4 className="mt-4 text-lg font-semibold text-neutral-900">
                  {isVi ? "Thanh toán thành công!" : "Payment Successful!"}
                </h4>
                <p className="mt-1 text-xs text-neutral-500">
                  {isVi
                    ? "Hệ thống đã nhận được tiền. Đang cập nhật trạng thái đơn hàng..."
                    : "Payment received. Updating order status..."}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50/80 px-3 py-1 text-xs font-medium text-[#174b3d]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#174b3d] animate-ping" />
                  <span>{isVi ? "Đang đồng bộ" : "Synchronizing"}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center">
                {/* QR Code Frame */}
                {qrImageSrc && (
                  <div className="relative flex flex-col items-center">
                    <div className="relative overflow-hidden rounded-xl border border-neutral-200/90 bg-white p-2.5 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImageSrc}
                        alt="VietQR PayOS"
                        className="h-56 w-56 object-contain"
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-500 text-center">
                      {isVi
                        ? "Mở ứng dụng ngân hàng bất kỳ để quét mã"
                        : "Open any banking app to scan this QR code"}
                    </p>
                  </div>
                )}

                {/* Transfer Info Card */}
                <div className="mt-3.5 w-full rounded-xl bg-neutral-50/80 p-3 border border-neutral-200/70 text-xs space-y-2">
                  {description && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 font-normal">
                        {isVi ? "Nội dung CK" : "Transfer Memo"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-neutral-900">
                          {description}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(description, "description")}
                          className="rounded-md border border-neutral-200/80 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-100 transition"
                        >
                          {copiedField === "description"
                            ? (isVi ? "Đã copy" : "Copied")
                            : (isVi ? "Sao chép" : "Copy")}
                        </button>
                      </div>
                    </div>
                  )}

                  {accountNumber && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/50">
                      <span className="text-neutral-500 font-normal">
                        {isVi ? "Số tài khoản" : "Account Number"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-neutral-900">
                          {accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(accountNumber, "accountNumber")
                          }
                          className="rounded-md border border-neutral-200/80 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-100 transition"
                        >
                          {copiedField === "accountNumber"
                            ? (isVi ? "Đã copy" : "Copied")
                            : (isVi ? "Sao chép" : "Copy")}
                        </button>
                      </div>
                    </div>
                  )}

                  {accountName && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/50">
                      <span className="text-neutral-500 font-normal">
                        {isVi ? "Chủ tài khoản" : "Account Holder"}
                      </span>
                      <span className="font-medium text-neutral-900">
                        {accountName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                <div className="mt-3 flex w-full items-center justify-between text-[11px] text-neutral-500 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isVi ? "Đang chờ thanh toán" : "Waiting for payment"}</span>
                  </div>
                </div>

                {/* Error message inside modal */}
                {errorMessage && (
                  <div className="mt-3.5 w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <span className="font-bold text-sm shrink-0">⚠️</span>
                    <span className="leading-snug">{errorMessage}</span>
                  </div>
                )}

                {/* Action button */}
                <div className="mt-4 w-full">
                  <button
                    type="button"
                    disabled={checkingPayment}
                    onClick={handleVerifyPayment}
                    className="w-full h-11 rounded-full bg-[#174b3d] hover:bg-[#103a2f] text-white text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {checkingPayment
                      ? (isVi ? "Đang kiểm tra giao dịch..." : "Checking payment...")
                      : (isVi ? "Tôi đã chuyển khoản" : "I have transferred")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Divider className="mt-8" />
    </div>
  )
}

export default PaymentDetails

