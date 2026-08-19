import { HttpTypes } from "@medusajs/types"
import { Container } from "@modules/common/components/ui"
import Checkbox from "@modules/common/components/checkbox"
import Input from "@modules/common/components/input"
import { mapKeys } from "lodash"
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"
import VietnamAddressSelect from "../vietnam-address-select"
import { useTranslation } from "@lib/i18n/client"
import { applyAddressAndRecalculateShipping } from "@lib/data/cart"

const ShippingAddress = ({
  customer,
  cart,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
}) => {
  const t = useTranslation()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [formData, setFormData] = useState<Record<string, string>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || customer?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || customer?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "700000",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code": cart?.shipping_address?.country_code?.toLowerCase() || "vn",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || customer?.phone || "",
    email: cart?.email || customer?.email || "",
  })
  const [selectedAddressMetadata, setSelectedAddressMetadata] = useState<
    Record<string, unknown> | undefined
  >(cart?.shipping_address?.metadata as Record<string, unknown> | undefined)

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2?.toLowerCase()),
    [cart?.region]
  )

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses?.filter(
        (a) =>
          a.country_code &&
          countriesInRegion?.includes(a.country_code?.toLowerCase())
      ) || [],
    [customer?.addresses, countriesInRegion]
  )

  const setFormAddress = useCallback(
    (address?: HttpTypes.StoreCartAddress, email?: string) => {
      if (address) {
        setSelectedAddressMetadata(
          address.metadata as Record<string, unknown> | undefined
        )
        setFormData((prevState: Record<string, string>) => ({
          ...prevState,
          "shipping_address.first_name": address.first_name || "",
          "shipping_address.last_name": address.last_name || "",
          "shipping_address.address_1": address.address_1 || "",
          "shipping_address.company": address.company || "",
          "shipping_address.postal_code": address.postal_code || "700000",
          "shipping_address.city": address.city || "",
          "shipping_address.country_code": address.country_code?.toLowerCase() || "vn",
          "shipping_address.province": address.province || "",
          "shipping_address.phone": address.phone || "",
        }))
      } else {
        setSelectedAddressMetadata(undefined)
        setFormData((prevState: Record<string, string>) => ({
          ...prevState,
          "shipping_address.first_name": customer?.first_name || "",
          "shipping_address.last_name": customer?.last_name || "",
          "shipping_address.address_1": "",
          "shipping_address.company": "",
          "shipping_address.postal_code": "700000",
          "shipping_address.city": "",
          "shipping_address.country_code": "vn",
          "shipping_address.province": "",
          "shipping_address.phone": customer?.phone || "",
        }))
      }

      if (email) {
        setFormData((prevState: Record<string, string>) => ({
          ...prevState,
          email: email,
        }))
      }
    },
    [customer?.first_name, customer?.last_name, customer?.phone]
  )

  // User manually selects a saved address from dropdown
  const handleSavedAddressSelect = useCallback(
    (address?: HttpTypes.StoreCartAddress, email?: string) => {
      setFormAddress(address, email)
      if (address) {
        startTransition(async () => {
          await applyAddressAndRecalculateShipping(address, email || cart?.email)
          router.refresh()
        })
      }
    },
    [setFormAddress, cart?.email, router]
  )

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)

  const handleVietnamAddressChange = useCallback(
    (data: {
      provinceId?: number
      provinceName?: string
      districtId?: number
      districtName?: string
      wardCode?: string
      wardName?: string
      streetAddress?: string
    }) => {
      if (data.provinceName) {
        setFormData((prev) => ({
          ...prev,
          "shipping_address.province": data.provinceName || prev["shipping_address.province"],
          "shipping_address.city": data.districtName || prev["shipping_address.city"],
          "shipping_address.address_1": [data.streetAddress, data.wardName].filter(Boolean).join(", "),
        }))
      }

      // Do not auto-trigger during initial mount
      if (isInitialMount.current) {
        isInitialMount.current = false
        return
      }

      if (data.districtId && data.wardCode) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
          startTransition(async () => {
            await applyAddressAndRecalculateShipping(
              {
                first_name: formData["shipping_address.first_name"] || customer?.first_name || "",
                last_name: formData["shipping_address.last_name"] || customer?.last_name || "",
                phone: formData["shipping_address.phone"] || customer?.phone || "",
                address_1: [data.streetAddress, data.wardName].filter(Boolean).join(", "),
                city: data.districtName || "",
                province: data.provinceName || "",
                country_code: "vn",
                postal_code: "700000",
                metadata: {
                  ghn_province_id: data.provinceId,
                  ghn_district_id: data.districtId,
                  ghn_ward_code: data.wardCode,
                },
              },
              formData.email || cart?.email
            )
            router.refresh()
          })
        }, 500)
      }
    },
    [formData, customer?.first_name, customer?.last_name, customer?.phone, cart?.email, router]
  )

  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (hasInitializedRef.current) return

    // If cart has an existing shipping address, populate it
    if (cart && cart.shipping_address && cart.shipping_address.address_1) {
      setFormAddress(cart.shipping_address, cart.email)
      hasInitializedRef.current = true
      return
    }

    // If cart has no shipping address, auto-select default / first saved address
    if (customer && addressesInRegion && addressesInRegion.length > 0) {
      const defaultAddr =
        addressesInRegion.find((a) => a.is_default_shipping) ||
        addressesInRegion[0]
      if (defaultAddr) {
        setFormAddress(defaultAddr as HttpTypes.StoreCartAddress, customer.email || cart?.email)
        hasInitializedRef.current = true
        return
      }
    }

    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
      hasInitializedRef.current = true
    }
  }, [cart, customer, addressesInRegion, setFormAddress])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <>
      {customer && (addressesInRegion.length > 0) && (
        <Container className="mb-6 flex flex-col gap-y-3 p-5 bg-ui-bg-subtle border border-ui-border-base rounded-rounded">
          <div className="flex justify-between items-center">
            <span className="text-small-semi text-ui-fg-base font-semibold">
              {t("checkout.saved_addresses_title")}
            </span>
            <span className="text-small-regular text-ui-fg-subtle">
              {t("account.hello", { name: customer.first_name || "" })}
            </span>
          </div>
          <AddressSelect
            addresses={addressesInRegion}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("shipping_address.", "")
              ) as unknown as HttpTypes.StoreCartAddress
            }
            onSelect={handleSavedAddressSelect}
          />
        </Container>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t("account.first_name")}
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-first-name-input"
        />
        <Input
          label={t("account.last_name")}
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-last-name-input"
        />
        <CountrySelect
          name="shipping_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["shipping_address.country_code"]}
          onChange={handleChange}
          required
          data-testid="shipping-country-select"
        />
        <Input
          label={t("account.company")}
          name="shipping_address.company"
          value={formData["shipping_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="shipping-company-input"
        />
        {formData["shipping_address.country_code"] === "vn" ? (
          <VietnamAddressSelect
            initialProvince={formData["shipping_address.province"]}
            initialCity={formData["shipping_address.city"]}
            initialAddress1={formData["shipping_address.address_1"]}
            initialMetadata={selectedAddressMetadata}
            onChange={handleVietnamAddressChange}
          />
        ) : (
          <>
            <Input
              label={t("account.address")}
              name="shipping_address.address_1"
              autoComplete="address-line1"
              value={formData["shipping_address.address_1"]}
              onChange={handleChange}
              required
              data-testid="shipping-address-input"
            />
            <Input
              label={t("account.postal_code")}
              name="shipping_address.postal_code"
              autoComplete="postal-code"
              value={formData["shipping_address.postal_code"]}
              onChange={handleChange}
              required
              data-testid="shipping-postal-code-input"
            />
            <Input
              label={t("account.city")}
              name="shipping_address.city"
              autoComplete="address-level2"
              value={formData["shipping_address.city"]}
              onChange={handleChange}
              required
              data-testid="shipping-city-input"
            />
            <Input
              label={t("account.province_state")}
              name="shipping_address.province"
              autoComplete="address-level1"
              value={formData["shipping_address.province"]}
              onChange={handleChange}
              data-testid="shipping-province-input"
            />
          </>
        )}
      </div>
      <div className="flex flex-col gap-y-3.5 my-6">
        {customer && (
          <Checkbox
            id="save-to-customer-address"
            name="save_to_customer"
            label={t("checkout.save_address_to_account")}
            defaultChecked
            data-testid="save-to-customer-address"
          />
        )}
        <input type="hidden" name="same_as_billing" value="on" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Input
          label={t("account.email")}
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
          data-testid="shipping-email-input"
        />
        <Input
          label={t("account.phone")}
          name="shipping_address.phone"
          autoComplete="tel"
          value={formData["shipping_address.phone"]}
          onChange={handleChange}
          required
          data-testid="shipping-phone-input"
        />
      </div>
    </>
  )
}

export default ShippingAddress

