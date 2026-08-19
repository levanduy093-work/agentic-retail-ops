"use client"

import { Button, Heading, Text } from "@modules/common/components/ui"
import { isStripeLike, paymentInfoMap } from "@lib/constants"
import Divider from "@modules/common/components/divider"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "@lib/i18n/client"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowPath,
  ArrowPathMini,
  CheckCircleSolid,
  Clock,
  CreditCard,
  InformationCircleSolid,
  XMark,
} from "@medusajs/icons"
import React, { useEffect, useMemo, useState } from "react"
import { checkPayosPaymentStatus, refreshPayosPayment } from "@lib/data/payment"

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
  const isPaid =
    order.payment_status === "captured" ||
    Boolean(payment?.captured_at) ||
    order.payment_collections?.[0]?.status === "completed"
  
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
  const initialSessionData = (payment?.data || {}) as Record<string, unknown>
  const [paymentData, setPaymentData] = useState<Record<string, unknown>>(initialSessionData)
  const [showModal, setShowModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [modalPaidSuccess, setModalPaidSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const qrCode = paymentData.qrCode as string | undefined
  const accountNumber = paymentData.accountNumber as string | undefined
  const accountName = paymentData.accountName as string | undefined
  const amount = (paymentData.amount as number | undefined) || payment?.amount || order.total
  const description = (paymentData.description as string | undefined) || `DH${order.display_id}`
  const bin = (paymentData.bin as string | undefined) || "970422"
  const orderCode = paymentData.orderCode as number | string | undefined
  const expiredAt = paymentData.expiredAt as number | undefined

  // Countdown timer calculation
  useEffect(() => {
    if (!expiredAt) {
      setTimeLeft(null)
      return
    }

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = expiredAt - now
      setTimeLeft(remaining > 0 ? remaining : 0)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiredAt])

  const isExpired = timeLeft !== null && timeLeft <= 0

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`
  }

  // Auto open modal if ?pay=true is in URL and unpaid
  useEffect(() => {
    if (searchParams?.get("pay") === "true" && !isPaid) {
      setShowModal(true)
    }
  }, [searchParams, isPaid])

  // Auto poll order payment status every 3 seconds if currently unpaid
  useEffect(() => {
    if (isPaid || !orderCode) return

    const interval = setInterval(async () => {
      try {
        const res = await checkPayosPaymentStatus(orderCode)
        if (res?.is_paid) {
          router.refresh()
        }
      } catch {}
    }, 3000)

    return () => clearInterval(interval)
  }, [isPaid, orderCode, router])

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

  const handleRegenerateQR = async () => {
    setIsRegenerating(true)
    setErrorMessage(null)
    try {
      const res = await refreshPayosPayment(order.id)
      if (res?.success && res.data) {
        setPaymentData(res.data as unknown as Record<string, unknown>)
      } else {
        setErrorMessage(
          res?.message ||
            (isVi
              ? "Không thể làm mới mã QR. Vui lòng thử lại sau."
              : "Could not refresh QR code. Please try again.")
        )
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRegenerating(false)
    }
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
    if (!showModal || !orderCode || isPaid || modalPaidSuccess || checkingPayment || isExpired) {
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
  }, [showModal, orderCode, isPaid, modalPaidSuccess, checkingPayment, isExpired, router])

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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
                  aria-label="Đóng"
                >
                  <XMark className="w-4 h-4" />
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
                {/* QR Code Frame with Blurred Background & Centered Reload Action */}
                <div className="relative flex flex-col items-center">
                  <div className="relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-2.5 shadow-2xs w-60 h-60 flex items-center justify-center">
                    {/* QR Background Layer */}
                    {qrImageSrc ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={qrImageSrc}
                        alt="VietQR PayOS"
                        className={`h-52 w-52 object-contain transition-all duration-300 ${
                          isExpired || !qrImageSrc
                            ? "opacity-20 blur-[2px] scale-95"
                            : "opacity-100"
                        }`}
                      />
                    ) : (
                      <svg
                        className="h-52 w-52 text-neutral-400 opacity-20 blur-[1px] transition-all"
                        viewBox="0 0 100 100"
                        fill="currentColor"
                      >
                        {/* Corner 1 */}
                        <rect x="10" y="10" width="24" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                        <rect x="16" y="16" width="12" height="12" rx="2" fill="currentColor" />
                        {/* Corner 2 */}
                        <rect x="66" y="10" width="24" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                        <rect x="72" y="16" width="12" height="12" rx="2" fill="currentColor" />
                        {/* Corner 3 */}
                        <rect x="10" y="66" width="24" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                        <rect x="16" y="72" width="12" height="12" rx="2" fill="currentColor" />
                        {/* QR Grid Pattern */}
                        <rect x="40" y="10" width="7" height="7" rx="1.5" />
                        <rect x="53" y="10" width="7" height="7" rx="1.5" />
                        <rect x="40" y="22" width="7" height="7" rx="1.5" />
                        <rect x="53" y="22" width="7" height="7" rx="1.5" />
                        <rect x="10" y="40" width="7" height="7" rx="1.5" />
                        <rect x="22" y="40" width="7" height="7" rx="1.5" />
                        <rect x="10" y="53" width="7" height="7" rx="1.5" />
                        <rect x="22" y="53" width="7" height="7" rx="1.5" />
                        <rect x="38" y="38" width="24" height="24" rx="4" fill="currentColor" />
                        <rect x="68" y="40" width="8" height="8" rx="1.5" />
                        <rect x="80" y="40" width="10" height="8" rx="1.5" />
                        <rect x="68" y="52" width="8" height="12" rx="1.5" />
                        <rect x="80" y="52" width="10" height="8" rx="1.5" />
                        <rect x="40" y="68" width="8" height="12" rx="1.5" />
                        <rect x="52" y="72" width="8" height="8" rx="1.5" />
                        <rect x="40" y="84" width="20" height="6" rx="1.5" />
                        <rect x="68" y="68" width="12" height="8" rx="1.5" />
                        <rect x="84" y="76" width="6" height="14" rx="1.5" />
                        <rect x="68" y="80" width="12" height="8" rx="1.5" />
                      </svg>
                    )}

                    {/* Expired / Missing Overlay with Centered Floating Reload Button */}
                    {(isExpired || !qrImageSrc) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center animate-fadeIn">
                        <button
                          type="button"
                          onClick={handleRegenerateQR}
                          disabled={isRegenerating}
                          className="group flex h-14 w-14 items-center justify-center rounded-full bg-[#174b3d] text-white shadow-lg hover:bg-[#103a2f] hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
                          aria-label={isVi ? "Tải lại mã QR" : "Reload QR code"}
                          title={isVi ? "Tải lại mã QR" : "Reload QR code"}
                        >
                          <ArrowPath
                            className={`h-6 w-6 ${
                              isRegenerating
                                ? "animate-spin"
                                : "group-hover:rotate-180 transition-transform duration-500"
                            }`}
                          />
                        </button>
                        <span className="mt-2.5 text-xs font-semibold text-neutral-800 drop-shadow-xs">
                          {isRegenerating
                            ? isVi
                              ? "Đang tạo mã..."
                              : "Generating..."
                            : isVi
                            ? "Tải lại mã QR"
                            : "Reload QR Code"}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-500 text-center">
                    {isExpired || !qrImageSrc
                      ? (isVi
                          ? "Nhấn nút để tải lại mã QR thanh toán mới"
                          : "Click button to reload a new payment QR")
                      : (isVi
                          ? "Mở ứng dụng ngân hàng bất kỳ để quét mã"
                          : "Open any banking app to scan this QR code")}
                  </p>
                </div>

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

                {/* Status indicator & refresh button (Minimal & Clean) */}
                <div className="mt-3 flex w-full items-center justify-between text-[11px] text-neutral-500 px-0.5">
                  <div className="flex items-center gap-1.5">
                    {isExpired || !qrImageSrc ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{isVi ? "Mã QR đã hết hạn" : "QR code expired"}</span>
                      </>
                    ) : timeLeft !== null ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{isVi ? "Hết hạn sau" : "Expires in"}</span>
                        <span className="font-mono font-medium tabular-nums text-neutral-700">
                          {formatTimer(timeLeft)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#174b3d] animate-pulse shrink-0" />
                        <span>{isVi ? "Đang chờ quét mã" : "Waiting for scan"}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateQR}
                    disabled={isRegenerating}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 transition disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowPathMini
                      className={`w-3 h-3 text-neutral-400 ${
                        isRegenerating ? "animate-spin text-[#174b3d]" : ""
                      }`}
                    />
                    <span>
                      {isRegenerating
                        ? isVi
                          ? "Đang tạo..."
                          : "Generating..."
                        : isVi
                        ? "Làm mới"
                        : "Refresh"}
                    </span>
                  </button>
                </div>

                {/* Error / Alert notice inside modal */}
                {errorMessage && (
                  <div className="mt-3.5 w-full rounded-xl bg-amber-50/80 border border-amber-200/70 p-3 text-xs flex items-start gap-2.5 animate-fadeIn">
                    <InformationCircleSolid className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed text-amber-900 font-normal">
                      {errorMessage}
                    </span>
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


