"use client"

import { Heading, Text } from "@modules/common/components/ui"
import { isStripeLike, paymentInfoMap } from "@lib/constants"
import Divider from "@modules/common/components/divider"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "@lib/i18n/client"
import { useParams } from "next/navigation"
import { CheckCircleSolid, Clock, CreditCard } from "@medusajs/icons"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const t = useTranslation()
  const { locale } = useParams<{ locale?: string }>()
  const payment = order.payment_collections?.[0]?.payments?.[0]
  const paymentDate = payment?.created_at
    ? new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(payment.created_at))
    : null

  const getProviderTitle = (providerId?: string) => {
    if (!providerId) return ""
    if (providerId === "pp_system_default") {
      return t("checkout.manual_payment") || "Manual Payment"
    }
    if (isStripeLike(providerId)) {
      return t("checkout.credit_card") || "Credit card"
    }
    return paymentInfoMap[providerId]?.title || providerId
  }

  const paymentTitle = payment ? getProviderTitle(payment.provider_id) : ""
  const paymentIcon = payment
    ? paymentInfoMap[payment.provider_id]?.icon ?? <CreditCard />
    : <CreditCard />

  return (
    <div>
      <Heading level="h2" className="flex flex-row text-3xl-regular my-6">
        {t("checkout.payment")}
      </Heading>

      {payment && (
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
                {isStripeLike(payment.provider_id) && payment.data?.card_last4 ? (
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
                    amount: payment.amount,
                    currency_code: order.currency_code,
                  })}
                </Text>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/80">
                  <CheckCircleSolid className="w-3.5 h-3.5 text-emerald-600" />
                  {t("checkout.paid_status")}
                </span>
              </div>

              {paymentDate && (
                <div className="flex items-center gap-1.5 text-xs text-ui-fg-muted">
                  <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span>
                    {t("order.paid_at")} {paymentDate}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Divider className="mt-8" />
    </div>
  )
}

export default PaymentDetails
