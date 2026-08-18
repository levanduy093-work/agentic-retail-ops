"use client"

import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import React, { useEffect, useState } from "react"
import ErrorMessage from "../error-message"
import { useTranslation } from "@lib/i18n/client"

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

export const PayOSPaymentButton: React.FC<PayOSPaymentButtonProps> = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}) => {
  const t = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

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
  const expiredAt = sessionData.expiredAt as number | undefined

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
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const onPaymentCompleted = async () => {
    try {
      setErrorMessage(null)
      setSubmitting(true)
      await placeOrder()
    } catch (err) {
      if (isNextRedirectError(err)) {
        throw err
      }
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  const handleOpenPay = () => {
    if (qrCode || checkoutUrl) {
      setShowModal(true)
    } else {
      onPaymentCompleted()
    }
  }

  return (
    <>
      <Button
        disabled={notReady || submitting || timeLeft === 0}
        isLoading={submitting}
        onClick={handleOpenPay}
        size="large"
        data-testid={dataTestId || "payos-payment-button"}
      >
        {t("checkout.place_order")}
      </Button>

      <ErrorMessage error={errorMessage} data-testid="payos-payment-error-message" />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Thanh toán VietQR
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            {/* Countdown timer */}
            {timeLeft !== null && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {timeLeft > 0 ? (
                  <>
                    <span>Thời gian thanh toán còn lại:</span>
                    <span className="font-bold text-amber-900 dark:text-amber-200">
                      {formatTimer(timeLeft)}
                    </span>
                  </>
                ) : (
                  <span className="text-rose-600 font-bold">Mã QR đã hết hạn!</span>
                )}
              </div>
            )}

            {/* QR Code image */}
            {qrCode ? (
              <div className="my-4 flex flex-col items-center justify-center">
                <div className="overflow-hidden rounded-xl border-2 border-neutral-200 p-2 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCode}
                    alt="VietQR PayOS"
                    className="h-56 w-56 object-contain"
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Mở ứng dụng ngân hàng và quét mã VietQR để thanh toán
                </p>
              </div>
            ) : null}

            {/* Bank details list */}
            <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
              {accountName && (
                <div className="flex justify-between items-center py-1 border-b border-neutral-200/60 dark:border-neutral-700/60">
                  <span className="text-neutral-500">Chủ tài khoản:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {accountName}
                  </span>
                </div>
              )}

              {accountNumber && (
                <div className="flex justify-between items-center py-1 border-b border-neutral-200/60 dark:border-neutral-700/60">
                  <span className="text-neutral-500">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                    <span>{accountNumber}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(accountNumber, "stk")}
                      className="text-primary hover:underline text-[10px]"
                    >
                      {copiedField === "stk" ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {amount !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-neutral-200/60 dark:border-neutral-700/60">
                  <span className="text-neutral-500">Số tiền:</span>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <span>{amount.toLocaleString("vi-VN")} đ</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(amount), "amount")}
                      className="text-primary hover:underline text-[10px] font-normal"
                    >
                      {copiedField === "amount" ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {description && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-neutral-500">Nội dung CK:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                    <span>{description}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(description, "desc")}
                      className="text-primary hover:underline text-[10px]"
                    >
                      {copiedField === "desc" ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-2">
              <Button
                size="large"
                isLoading={submitting}
                disabled={submitting || timeLeft === 0}
                onClick={onPaymentCompleted}
              >
                Tôi đã chuyển khoản thành công
              </Button>

              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 underline py-1"
                >
                  Mở trang thanh toán PayOS →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PayOSPaymentButton
