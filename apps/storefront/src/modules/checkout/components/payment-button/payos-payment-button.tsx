"use client"

import { initiatePaymentSession, placeOrder } from "@lib/data/cart"
import { checkPayosPaymentStatus } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import React, { useEffect, useMemo, useRef, useState } from "react"
import ErrorMessage from "../error-message"
import { useTranslation } from "@lib/i18n/client"
import { useRouter } from "next/navigation"
import {
  ArrowPath,
  ArrowPathMini,
  Clock,
  InformationCircleSolid,
  XMark,
} from "@medusajs/icons"

type PayOSPaymentButtonProps = {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

const isNextRedirectError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string" &&
  error.digest.startsWith("NEXT_REDIRECT")

const PayOSPaymentButton: React.FC<PayOSPaymentButtonProps> = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}) => {
  const t = useTranslation()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const isCompletingRef = useRef(false)

  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (s) => s.provider_id?.startsWith("pp_payos")
  )

  const sessionData = (paymentSession?.data || {}) as Record<string, unknown>
  const qrCode = sessionData.qrCode as string | undefined
  const checkoutUrl = sessionData.checkoutUrl as string | undefined
  const accountNumber = sessionData.accountNumber as string | undefined
  const accountName = sessionData.accountName as string | undefined
  const amount = sessionData.amount as number | undefined
  const description = sessionData.description as string | undefined
  const bin = (sessionData.bin as string | undefined) || "970422"
  const expiredAt = sessionData.expiredAt as number | undefined
  const orderCode = sessionData.orderCode as number | string | undefined

  const isExpired = timeLeft !== null && timeLeft <= 0

  const qrImageSrc = useMemo(() => {
    if (!qrCode && !accountNumber) return undefined
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

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleRegenerateQR = async () => {
    setIsRegenerating(true)
    setErrorMessage(null)
    try {
      await initiatePaymentSession(cart, {
        provider_id: "pp_payos_payos",
      })
      router.refresh()
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRegenerating(false)
    }
  }

  const onPaymentCompleted = async () => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await placeOrder()
    } catch (err: unknown) {
      isCompletingRef.current = false
      if (isNextRedirectError(err)) {
        throw err
      }
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyAndComplete = async () => {
    if (submitting || isCompletingRef.current) return
    setSubmitting(true)
    setErrorMessage(null)

    try {
      if (orderCode) {
        const res = await checkPayosPaymentStatus(orderCode)
        if (res?.is_paid) {
          setIsPaid(true)
          setTimeout(() => {
            onPaymentCompleted()
          }, 1000)
          return
        } else {
          setErrorMessage(
            "Hệ thống chưa ghi nhận được tiền chuyển khoản. Vui lòng kiểm tra lại giao dịch trong app ngân hàng của bạn hoặc đợi vài giây rồi thử lại."
          )
          setSubmitting(false)
          return
        }
      }

      // If no orderCode or no QR, complete directly
      await onPaymentCompleted()
    } catch (err: unknown) {
      if (isNextRedirectError(err)) {
        throw err
      }
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }


  // Real-time Polling: Check whether money has been received on PayOS every 3 seconds
  useEffect(() => {
    if (!showModal || !orderCode || isPaid || isExpired || submitting) {
      return
    }

    let isSubscribed = true

    const checkStatus = async () => {
      try {
        const res = await checkPayosPaymentStatus(orderCode)
        if (isSubscribed && res?.is_paid && !isPaid) {
          setIsPaid(true)
          setTimeout(() => {
            onPaymentCompleted()
          }, 1200)
        }
      } catch {
        // Silently continue polling
      }
    }

    const interval = setInterval(checkStatus, 3000)
    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [showModal, orderCode, isPaid, isExpired, submitting])

  const handleOpenPay = () => {
    if (isExpired) {
      handleRegenerateQR()
    }
    if (qrImageSrc || checkoutUrl) {
      setShowModal(true)
    } else {
      onPaymentCompleted()
    }
  }

  return (
    <>
      <Button
        disabled={notReady || submitting || isRegenerating}
        isLoading={submitting || isRegenerating}
        onClick={handleOpenPay}
        size="large"
        data-testid={dataTestId || "payos-payment-button"}
      >
        {t("checkout.place_order")}
      </Button>

      <ErrorMessage
        error={!showModal ? errorMessage : null}
        data-testid="payos-payment-error-message"
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] animate-fadeIn">
          <div className="relative w-full max-w-[400px] overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-neutral-200/80 transition-all">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 tracking-tight">
                  Thanh toán VietQR
                </h3>
                {amount && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Số tiền:{" "}
                    <span className="font-semibold text-neutral-900">
                      {new Intl.NumberFormat("vi-VN").format(amount)} ₫
                    </span>
                  </p>
                )}
              </div>
              {!isPaid && (
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
            {isPaid ? (
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
                  Thanh toán thành công!
                </h4>
                <p className="mt-1 text-xs text-neutral-500">
                  Hệ thống đã nhận được tiền. Đang hoàn tất đơn hàng...
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50/80 px-3 py-1 text-xs font-medium text-[#174b3d]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#174b3d] animate-ping" />
                  <span>Đang chuyển hướng</span>
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
                          aria-label="Tải lại mã QR"
                          title="Tải lại mã QR"
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
                          {isRegenerating ? "Đang tạo mã..." : "Tải lại mã QR"}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-500 text-center">
                    {isExpired || !qrImageSrc
                      ? "Nhấn nút để tải lại mã QR thanh toán mới"
                      : "Mở ứng dụng ngân hàng bất kỳ để quét mã"}
                  </p>
                </div>

                {/* Transfer Info Card (Clean & Compact) */}
                <div className="mt-3.5 w-full rounded-xl bg-neutral-50/80 p-3 border border-neutral-200/70 text-xs space-y-2">
                  {description && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 font-normal">
                        Nội dung CK
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
                          {copiedField === "description" ? "Đã copy" : "Sao chép"}
                        </button>
                      </div>
                    </div>
                  )}

                  {accountNumber && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/50">
                      <span className="text-neutral-500 font-normal">
                        Số tài khoản
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
                            ? "Đã copy"
                            : "Sao chép"}
                        </button>
                      </div>
                    </div>
                  )}

                  {accountName && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/50">
                      <span className="text-neutral-500 font-normal">
                        Chủ tài khoản
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
                        <span>Mã QR đã hết hạn</span>
                      </>
                    ) : timeLeft !== null ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>Hết hạn sau</span>
                        <span className="font-mono font-medium tabular-nums text-neutral-700">
                          {formatTimer(timeLeft)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#174b3d] animate-pulse shrink-0" />
                        <span>Đang chờ quét mã</span>
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
                    <span>{isRegenerating ? "Đang tạo..." : "Làm mới"}</span>
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
                    disabled={submitting}
                    onClick={handleVerifyAndComplete}
                    className="w-full h-11 rounded-full bg-[#174b3d] hover:bg-[#103a2f] text-white text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {submitting ? "Đang kiểm tra thanh toán..." : "Tôi đã chuyển khoản"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default PayOSPaymentButton
