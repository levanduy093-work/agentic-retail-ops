"use client"
import { Radio, RadioGroup } from "@headlessui/react"
import { setShippingMethod } from "@lib/data/cart"
import { calculateShippingQuote, ShippingPackage } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import { CheckCircleSolid, Loader } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import MedusaRadio from "@modules/common/components/radio"
import { Button, clx, Heading, Text } from "@modules/common/components/ui"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "@lib/i18n/client"
import { setCheckoutStep } from "@modules/checkout/utils/set-checkout-step"

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

type CalculatedShippingQuote = {
  amount: number
  packages: ShippingPackage[]
  totalWeight: number
}

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

function formatAddress(address: HttpTypes.StoreCartAddress) {
  if (!address) {
    return ""
  }

  let ret = ""

  if (address.address_1) {
    ret += ` ${address.address_1}`
  }

  if (address.address_2) {
    ret += `, ${address.address_2}`
  }

  if (address.postal_code) {
    ret += `, ${address.postal_code} ${address.city}`
  }

  if (address.country_code) {
    ret += `, ${address.country_code.toUpperCase()}`
  }

  return ret
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const t = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isSynchronizingSelection, setIsSynchronizingSelection] =
    useState(false)

  const [showPickupOptions, setShowPickupOptions] =
    useState<string>(PICKUP_OPTION_OFF)

  const existingMethod = cart.shipping_methods?.at(-1)
  const initialPricesMap = useMemo(() => {
    if (existingMethod?.shipping_option_id && existingMethod?.amount != null) {
      return {
        [existingMethod.shipping_option_id]: {
          amount: existingMethod.amount,
          packages:
            (existingMethod.data?.shipping_packages as ShippingPackage[]) || [],
          totalWeight: Number(existingMethod.data?.ghn_weight) || 300,
        },
      }
    }
    return {}
  }, [existingMethod])

  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, CalculatedShippingQuote>
  >(initialPricesMap)

  const isInitialPriceReady =
    availableShippingMethods &&
    availableShippingMethods.length > 0 &&
    availableShippingMethods.every(
      (sm) => sm.price_type === "flat" || !!initialPricesMap[sm.id]
    )

  const [isLoadingPrices, setIsLoadingPrices] = useState(!isInitialPriceReady)
  const [error, setError] = useState<string | null>(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    cart.shipping_methods?.at(-1)?.shipping_option_id || null
  )
  const syncedSelectionKeyRef = useRef<string | null>(null)

  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "delivery"
  const cartShippingMethodId =
    cart.shipping_methods?.at(-1)?.shipping_option_id || null

  useEffect(() => {
    const currentId = cart.shipping_methods?.at(-1)?.shipping_option_id || null
    setShippingMethodId(currentId)
    if (!currentId) {
      setCalculatedPricesMap({})
      setIsLoadingPrices(true)
    }
  }, [cart.shipping_methods])

  const _shippingMethods = useMemo(
    () =>
      availableShippingMethods?.filter(
        (sm) =>
          (
            sm as unknown as {
              service_zone?: {
                fulfillment_set?: {
                  type?: string
                  location?: { address: HttpTypes.StoreCartAddress }
                }
              }
            }
          ).service_zone?.fulfillment_set?.type !== "pickup"
      ),
    [availableShippingMethods]
  )

  const _pickupMethods = useMemo(
    () =>
      availableShippingMethods?.filter(
        (sm) =>
          (
            sm as unknown as {
              service_zone?: {
                fulfillment_set?: {
                  type?: string
                  location?: { address: HttpTypes.StoreCartAddress }
                }
              }
            }
          ).service_zone?.fulfillment_set?.type === "pickup"
      ),
    [availableShippingMethods]
  )

  const hasPickupOptions = !!_pickupMethods?.length
  const selectedShippingOption = _shippingMethods?.find(
    (option) => option.id === shippingMethodId,
  )
  const isSelectedShippingQuoteReady =
    !selectedShippingOption ||
    selectedShippingOption.price_type !== "calculated" ||
    !!calculatedPricesMap[selectedShippingOption.id]

  useEffect(() => {
    let cancelled = false

    if (!isOpen || !_shippingMethods?.length) {
      setIsLoadingPrices(false)
      return
    }

    const calculatedMethods = _shippingMethods.filter(
      (sm) => sm.price_type === "calculated"
    )

    if (!calculatedMethods.length) {
      setIsLoadingPrices(false)
      return
    }

    // Only show loading if we don't have prices yet
    const hasAllPrices = calculatedMethods.every(
      (sm) => !!calculatedPricesMap[sm.id]
    )
    if (hasAllPrices) {
      setIsLoadingPrices(false)
      return
    }

    setIsLoadingPrices(true)

    const promises = calculatedMethods.map((sm) =>
      calculateShippingQuote(sm.id, cart.id)
    )

    Promise.allSettled(promises).then((res) => {
      if (cancelled) {
        return
      }

      const pricesMap: Record<string, CalculatedShippingQuote> = {}
      res
        .filter((r) => r.status === "fulfilled")
        .forEach((p) => {
          if (p.value?.option.id) {
            pricesMap[p.value.option.id] = {
              amount: p.value.option.amount ?? 0,
              packages: p.value.packages,
              totalWeight: p.value.totalWeight,
            }
          }
        })

      setCalculatedPricesMap((prev) => ({ ...prev, ...pricesMap }))
      setIsLoadingPrices(false)

      const selectedQuote = cartShippingMethodId
        ? pricesMap[cartShippingMethodId]
        : undefined

      if (!selectedQuote || !cartShippingMethodId) {
        return
      }

      const selectionKey = [
        cart.id,
        cartShippingMethodId,
        cart.shipping_address?.metadata?.ghn_district_id ?? "",
        cart.shipping_address?.metadata?.ghn_ward_code ?? "",
        selectedQuote.amount,
        selectedQuote.totalWeight,
      ].join(":")

      if (syncedSelectionKeyRef.current === selectionKey) {
        return
      }

      const currentMethod = cart.shipping_methods?.find(
        (sm) => sm.shipping_option_id === cartShippingMethodId
      )

      if (
        currentMethod &&
        currentMethod.amount === selectedQuote.amount
      ) {
        syncedSelectionKeyRef.current = selectionKey
        return
      }

      syncedSelectionKeyRef.current = selectionKey
      setIsSynchronizingSelection(true)
      setShippingMethod({
        cartId: cart.id,
        shippingMethodId: cartShippingMethodId,
        data: {
          ghn_weight: selectedQuote.totalWeight,
          shipping_packages: selectedQuote.packages,
        },
      })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err))
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSynchronizingSelection(false)
          }
        })
    })

    if (_pickupMethods?.find((m) => m.id === shippingMethodId)) {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }

    return () => {
      cancelled = true
    }
  }, [
    cart.id,
    cartShippingMethodId,
    cart.shipping_methods,
    cart.shipping_address?.metadata?.ghn_district_id,
    cart.shipping_address?.metadata?.ghn_ward_code,
    isOpen,
    _pickupMethods,
    _shippingMethods,
    shippingMethodId,
  ])

  const handleEdit = () => {
    setCheckoutStep("delivery")
  }

  const handleSubmit = () => {
    setCheckoutStep("payment")
  }

  const handleSetShippingMethod = async (
    id: string,
    variant: "shipping" | "pickup"
  ) => {
    setError(null)

    if (variant === "pickup") {
      setShowPickupOptions(PICKUP_OPTION_ON)
    } else {
      setShowPickupOptions(PICKUP_OPTION_OFF)
    }

    let currentId: string | null = null
    setIsLoading(true)
    setShippingMethodId((prev) => {
      currentId = prev
      return id
    })

    const quote = calculatedPricesMap[id]

    await setShippingMethod({
      cartId: cart.id,
      shippingMethodId: id,
      data: quote
        ? {
            ghn_weight: quote.totalWeight,
            shipping_packages: quote.packages,
          }
        : undefined,
    })
      .catch((err) => {
        setShippingMethodId(currentId)

        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  useEffect(() => {
    setShippingMethodId(cartShippingMethodId)
  }, [cartShippingMethodId])

  return (
    <div className="bg-white" data-checkout-step="delivery">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && cart.shipping_methods?.length === 0,
            }
          )}
        >
          {t("order.delivery")}
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && (
            <CheckCircleSolid />
          )}
        </Heading>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
            <Text>
              <button
                onClick={handleEdit}
                className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                data-testid="edit-delivery-button"
              >
                {t("account.edit")}
              </button>
            </Text>
          )}
      </div>
      {isOpen ? (
        <>
          <div className="grid">
            <div className="flex flex-col">
              <span className="font-medium txt-medium text-ui-fg-base">
                {t("checkout.shipping_method")}
              </span>
              <span className="mb-4 text-ui-fg-muted txt-medium">
                {t("checkout.shipping_method_desc")}
              </span>
            </div>
            <div data-testid="delivery-options-container">
              <div className="pb-8 md:pt-0 pt-2">
                {hasPickupOptions && (
                  <RadioGroup
                    value={showPickupOptions}
                    onChange={(_value) => {
                      const id = _pickupMethods.find(
                        (option) => !option.insufficient_inventory
                      )?.id

                      if (id) {
                        handleSetShippingMethod(id, "pickup")
                      }
                    }}
                  >
                    <Radio
                      value={PICKUP_OPTION_ON}
                      data-testid="delivery-option-radio"
                      className={clx(
                        "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                        {
                          "border-ui-border-interactive":
                            showPickupOptions === PICKUP_OPTION_ON,
                        }
                      )}
                    >
                      <div className="flex items-center gap-x-4">
                        <MedusaRadio
                          checked={showPickupOptions === PICKUP_OPTION_ON}
                        />
                        <span className="text-base-regular">
                          {t("checkout.pick_up")}
                        </span>
                      </div>
                      <span className="justify-self-end text-ui-fg-base">
                        -
                      </span>
                    </Radio>
                  </RadioGroup>
                )}
                <RadioGroup
                  value={shippingMethodId}
                  onChange={(v) => {
                    if (v && !isLoadingPrices) {
                      return handleSetShippingMethod(v, "shipping")
                    }
                  }}
                >
                  {_shippingMethods?.map((option) => {
                    const isDisabled =
                      isLoadingPrices ||
                      (option.price_type === "calculated" &&
                        !calculatedPricesMap[option.id])

                    return (
                      <Radio
                        key={option.id}
                        value={option.id}
                        data-testid="delivery-option-radio"
                        disabled={isDisabled}
                        className={clx(
                          "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                          {
                            "border-ui-border-interactive":
                              option.id === shippingMethodId,
                            "hover:shadow-brders-none cursor-not-allowed opacity-75":
                              isDisabled,
                          }
                        )}
                      >
                        <div className="flex items-center gap-x-4">
                          <MedusaRadio
                            checked={option.id === shippingMethodId}
                          />
                          <span className="text-base-regular">
                            {option.name}
                          </span>
                        </div>
                        <span className="justify-self-end text-ui-fg-base">
                          {option.price_type === "flat" ? (
                            convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })
                          ) : calculatedPricesMap[option.id] ? (
                            convertToLocale({
                              amount: calculatedPricesMap[option.id].amount,
                              currency_code: cart?.currency_code,
                            })
                          ) : isLoadingPrices ? (
                            <span className="flex items-center gap-x-1.5 text-ui-fg-muted text-xs">
                              <Loader className="animate-spin" />
                              <span>{t("common.calculating_shipping") || "Đang tính cước..."}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </span>
                      </Radio>
                    )
                  })}
                </RadioGroup>
              </div>
            </div>
          </div>

          {showPickupOptions === PICKUP_OPTION_ON && (
            <div className="grid">
              <div className="flex flex-col">
                <span className="font-medium txt-medium text-ui-fg-base">
                  {t("checkout.pickup_store")}
                </span>
                <span className="mb-4 text-ui-fg-muted txt-medium">
                  {t("checkout.choose_store_near_you")}
                </span>
              </div>
              <div data-testid="delivery-options-container">
                <div className="pb-8 md:pt-0 pt-2">
                  <RadioGroup
                    value={shippingMethodId}
                    onChange={(v) => {
                      if (v) {
                        return handleSetShippingMethod(v, "pickup")
                      }
                    }}
                  >
                    {_pickupMethods?.map((option) => {
                      return (
                        <Radio
                          key={option.id}
                          value={option.id}
                          disabled={option.insufficient_inventory}
                          data-testid="delivery-option-radio"
                          className={clx(
                            "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                            {
                              "border-ui-border-interactive":
                                option.id === shippingMethodId,
                              "hover:shadow-brders-none cursor-not-allowed":
                                option.insufficient_inventory,
                            }
                          )}
                        >
                          <div className="flex items-start gap-x-4">
                            <MedusaRadio
                              checked={option.id === shippingMethodId}
                            />
                            <div className="flex flex-col">
                              <span className="text-base-regular">
                                {option.name}
                              </span>
                              <span className="text-base-regular text-ui-fg-muted">
                                {formatAddress(
                                  (
                                    option as unknown as {
                                      service_zone?: {
                                        fulfillment_set?: {
                                          location?: {
                                            address: HttpTypes.StoreCartAddress
                                          }
                                        }
                                      }
                                    }
                                  ).service_zone?.fulfillment_set?.location
                                    ?.address as HttpTypes.StoreCartAddress
                                )}
                              </span>
                            </div>
                          </div>
                          <span className="justify-self-end text-ui-fg-base">
                            {convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })}
                          </span>
                        </Radio>
                      )
                    })}
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <Button
              size="large"
              className="mt-6"
              onClick={handleSubmit}
              isLoading={isLoading || isSynchronizingSelection}
              disabled={
                !shippingMethodId ||
                !isSelectedShippingQuoteReady ||
                isLoading ||
                isLoadingPrices ||
                isSynchronizingSelection
              }
              data-testid="submit-delivery-option-button"
            >
              {t("checkout.continue_to_payment")}
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  {t("order.method")}
                </Text>
                <Text className="txt-medium text-ui-fg-subtle">
                  {cart.shipping_methods!.at(-1)!.name}{" "}
                  {convertToLocale({
                    amount: cart.shipping_methods!.at(-1)!.amount!,
                    currency_code: cart?.currency_code,
                  })}
                </Text>
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
