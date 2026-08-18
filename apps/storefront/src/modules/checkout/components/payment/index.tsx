"use client"
import { RadioGroup } from "@headlessui/react"
import { isStripeLike, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripeCardContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import {
  Button,
  Heading,
  Text,
  clx,
} from "@modules/common/components/ui"
import { HttpTypes } from "@medusajs/types"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslation } from "@lib/i18n/client"
import { setCheckoutStep } from "@modules/checkout/utils/set-checkout-step"

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
}) => {
  const t = useTranslation()
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "payment"

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    if (isStripeLike(method)) {
      await initiatePaymentSession(cart, {
        provider_id: method,
      })
    }
  }

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards &&
    ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])
      ?.length > 0 &&
    cart?.total === 0
  )

  const paymentReady =
    (activeSession && (cart?.shipping_methods?.length ?? 0) !== 0) ||
    paidByGiftcard

  const handleEdit = () => {
    setCheckoutStep("payment")
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const shouldInputCard =
        isStripeLike(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!shouldInputCard) {
        setCheckoutStep("review")
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !paymentReady,
            }
          )}
        >
          {t("checkout.payment")}
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-payment-button"
            >
              {t("account.edit")}
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {availablePaymentMethods.map((paymentMethod) => (
                  <div key={paymentMethod.id}>
                    {isStripeLike(paymentMethod.id) ? (
                      <StripeCardContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setCardBrand={setCardBrand}
                        setError={setError}
                        setCardComplete={setCardComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                {t("checkout.payment_method")}
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                {t("checkout.gift_card")}
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              (isStripeLike(selectedPaymentMethod) && !cardComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {!activeSession && isStripeLike(selectedPaymentMethod)
              ? t("checkout.enter_card_details")
              : t("checkout.continue_to_review")}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col justify-start">
                <Text className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted mb-3">
                  {t("checkout.payment_method")}
                </Text>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-neutral-200/90 text-[#174b3d] shadow-xs">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </div>
                  <Text
                    className="text-sm font-semibold text-ui-fg-base"
                    data-testid="payment-method-summary"
                  >
                    {activeSession?.provider_id === "pp_system_default"
                      ? t("checkout.manual_payment") || "Manual Payment"
                      : isStripeLike(activeSession?.provider_id)
                      ? t("checkout.credit_card") || "Credit card"
                      : paymentInfoMap[activeSession?.provider_id]?.title ||
                        activeSession?.provider_id}
                  </Text>
                </div>
              </div>
              <div className="flex flex-col justify-start border-t border-neutral-200/70 pt-4 md:border-t-0 md:border-l md:border-neutral-200/80 md:pt-0 md:pl-6">
                <Text className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted mb-3">
                  {t("checkout.payment_details")}
                </Text>
                <div
                  className="flex items-center gap-2 text-sm text-ui-fg-base font-medium"
                  data-testid="payment-details-summary"
                >
                  <Text>
                    {isStripeLike(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : t("checkout.another_step_payment")}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-5 sm:p-6 shadow-xs">
              <Text className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted mb-2">
                {t("checkout.payment_method")}
              </Text>
              <Text
                className="text-sm font-semibold text-ui-fg-base"
                data-testid="payment-method-summary"
              >
                {t("checkout.gift_card")}
              </Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment
