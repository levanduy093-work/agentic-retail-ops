"use client"
import { setAddresses, SetAddressesState } from "@lib/data/cart"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import Divider from "@modules/common/components/divider"
import { Heading, Text } from "@modules/common/components/ui"
import Spinner from "@modules/common/icons/spinner"
import { useSearchParams } from "next/navigation"
import { useActionState, useCallback, useEffect, useState } from "react"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"
import { useTranslation } from "@lib/i18n/client"
import { setCheckoutStep } from "@modules/checkout/utils/set-checkout-step"

const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const t = useTranslation()
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "address"

  const handleEdit = () => {
    setCheckoutStep("address")
  }

  const [result, formAction] = useActionState<
    SetAddressesState | null,
    FormData
  >(setAddresses, null)
  const [isAdvancing, setIsAdvancing] = useState(false)

  const moveToDelivery = useCallback(() => {
    setCheckoutStep("delivery")
    requestAnimationFrame(() => {
      document
        .querySelector("[data-checkout-step='delivery']")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  useEffect(() => {
    if (!isAdvancing) {
      return
    }

    if (result?.success) {
      setIsAdvancing(false)
      moveToDelivery()
    } else if (result?.error) {
      setIsAdvancing(false)
      setCheckoutStep("address", { replace: true })
    }
  }, [isAdvancing, moveToDelivery, result])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
        >
          {t("checkout.shipping_address")}
          {!isOpen && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart?.shipping_address && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover cursor-pointer"
              data-testid="edit-address-button"
            >
              {t("account.edit")}
            </button>
          </Text>
        )}
      </div>
      {isOpen ? (
        <form
          action={formAction}
          onSubmit={() => {
            setIsAdvancing(true)
          }}
        >
          <div className="pb-8">
            <ShippingAddress
              customer={customer}
              cart={cart}
            />

            <SubmitButton className="mt-6" data-testid="submit-address-button">
              {t("checkout.continue_to_shipping")}
            </SubmitButton>
            <ErrorMessage
              error={result?.error}
              data-testid="address-error-message"
            />
          </div>
        </form>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && cart.shipping_address ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div
                  className="flex flex-col"
                  data-testid="shipping-address-summary"
                >
                  <Text className="txt-medium-plus text-ui-fg-base mb-1 font-medium">
                    {t("checkout.shipping_address")}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.shipping_address.first_name}{" "}
                    {cart.shipping_address.last_name}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.shipping_address.address_1}{" "}
                    {cart.shipping_address.address_2}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.shipping_address.city}
                    {cart.shipping_address.province &&
                    cart.shipping_address.city !== cart.shipping_address.province
                      ? `, ${cart.shipping_address.province}`
                      : ""}
                  </Text>
                </div>

                <div
                  className="flex flex-col"
                  data-testid="shipping-contact-summary"
                >
                  <Text className="txt-medium-plus text-ui-fg-base mb-1 font-medium">
                    {t("order.contact")}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.shipping_address.phone}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.email}
                  </Text>
                </div>
              </div>
            ) : (
              <div>
                <Spinner />
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Addresses
