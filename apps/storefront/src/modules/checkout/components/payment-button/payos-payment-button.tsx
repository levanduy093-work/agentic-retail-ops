"use client"

import { initiatePaymentSession, placeOrder } from "@lib/data/cart"
import { checkPayosPaymentStatus } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import React, { useEffect, useMemo, useRef, useState } from "react"
import ErrorMessage from "../error-message"
import { useTranslation } from "@lib/i18n/client"
import { useRouter } from "next/navigation"

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
        error={errorMessage}
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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
                  aria-label="Đóng"
                >
                  ✕
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
                {/* QR Code Frame */}
                {qrImageSrc && (
                  <div className="relative flex flex-col items-center">
                    <div className="relative overflow-hidden rounded-xl border border-neutral-200/90 bg-white p-2.5 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImageSrc}
                        alt="VietQR PayOS"
                        className={`h-56 w-56 object-contain transition-opacity duration-200 ${
                          isExpired ? "opacity-25 blur-[1px]" : "opacity-100"
                        }`}
                      />
                      {isExpired && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 p-4 text-center">
                          <p className="text-xs font-medium text-neutral-700 mb-2.5">
                            Mã QR đã hết hạn
                          </p>
                          <button
                            type="button"
                            onClick={handleRegenerateQR}
                            disabled={isRegenerating}
                            className="rounded-full bg-[#174b3d] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#103a2f] transition"
                          >
                            {isRegenerating ? "Đang tạo..." : "Tạo mã QR mới"}
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-500 text-center">
                      Mở ứng dụng ngân hàng bất kỳ để quét mã
                    </p>
                  </div>
                )}

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

                {/* Status bar with subtle timer */}
                <div className="mt-3 flex w-full items-center justify-between text-[11px] text-neutral-500 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {isExpired
                        ? "Hết thời gian"
                        : timeLeft !== null
                        ? `Hết hạn sau ${formatTimer(timeLeft)}`
                        : "Đang chờ thanh toán"}
                    </span>
                  </div>
                  {!isExpired && (
                    <button
                      type="button"
                      onClick={handleRegenerateQR}
                      disabled={isRegenerating}
                      className="text-neutral-500 hover:text-neutral-800 underline transition cursor-pointer"
                    >
                      {isRegenerating ? "Đang tạo..." : "Làm mới"}
                    </button>
                  )}
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
