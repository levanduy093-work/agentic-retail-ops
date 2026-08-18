"use client"

import { Listbox, Transition } from "@headlessui/react"
import { ChevronUpDown, Plus } from "@medusajs/icons"
import { Badge, clx } from "@modules/common/components/ui"
import { Fragment, useMemo } from "react"
import { useTranslation } from "@lib/i18n/client"

import compareAddresses from "@lib/util/compare-addresses"
import { HttpTypes } from "@medusajs/types"
import Radio from "@modules/common/components/radio"

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[]
  addressInput: HttpTypes.StoreCartAddress | null
  onSelect: (
    address: HttpTypes.StoreCartAddress | undefined,
    email?: string
  ) => void
}

const AddressSelect = ({
  addresses,
  addressInput,
  onSelect,
}: AddressSelectProps) => {
  const t = useTranslation()

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => addressInput && compareAddresses(a, addressInput))
  }, [addresses, addressInput])

  const handleSelect = (id: string) => {
    if (id === "new") {
      onSelect(undefined)
      return
    }
    const savedAddress = addresses.find((a) => a.id === id)
    if (savedAddress) {
      onSelect(savedAddress as HttpTypes.StoreCartAddress)
    }
  }

  return (
    <Listbox onChange={handleSelect} value={selectedAddress?.id ?? "new"}>
      <div className="relative">
        <Listbox.Button
          className="relative w-full flex justify-between items-center px-4 py-3 text-left bg-white cursor-pointer focus:outline-none border border-ui-border-base rounded-rounded hover:border-ui-border-interactive focus-visible:ring-2 focus-visible:ring-ui-fg-interactive text-base-regular shadow-xs transition-colors"
          data-testid="shipping-address-select"
        >
          {({ open }) => (
            <>
              <span className="block truncate font-medium text-ui-fg-base text-small-regular">
                {selectedAddress ? (
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ui-fg-base">
                      {selectedAddress.first_name} {selectedAddress.last_name}
                    </span>
                    {selectedAddress.phone && (
                      <span className="text-ui-fg-muted font-normal">
                        ({selectedAddress.phone})
                      </span>
                    )}
                    <span className="text-ui-fg-subtle font-normal truncate">
                      — {selectedAddress.address_1}
                      {selectedAddress.city ? `, ${selectedAddress.city}` : ""}
                      {selectedAddress.province ? `, ${selectedAddress.province}` : ""}
                    </span>
                    {selectedAddress.is_default_shipping && (
                      <Badge size="small" color="blue" className="ml-1">
                        {t("checkout.default_badge")}
                      </Badge>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-ui-fg-interactive font-medium">
                    <Plus />
                    {t("checkout.new_shipping_address")}
                  </span>
                )}
              </span>
              <ChevronUpDown
                className={clx("transition-transform duration-200 text-ui-fg-muted ml-2 shrink-0", {
                  "transform rotate-180": open,
                })}
              />
            </>
          )}
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            className="absolute z-30 w-full mt-1 overflow-auto text-small-regular bg-white border border-ui-border-base rounded-rounded shadow-lg max-h-72 focus:outline-none sm:text-sm divide-y divide-ui-border-subtle"
            data-testid="shipping-address-options"
          >
            {/* New Address Option */}
            <Listbox.Option
              key="new"
              value="new"
              className={({ active }) =>
                clx(
                  "cursor-pointer select-none relative px-4 py-3 transition-colors",
                  active ? "bg-ui-bg-subtle-hover text-ui-fg-base" : "bg-white text-ui-fg-base",
                  !selectedAddress && "bg-ui-bg-subtle"
                )
              }
              data-testid="shipping-address-option-new"
            >
              <div className="flex gap-x-3 items-center">
                <Radio
                  checked={!selectedAddress}
                  data-testid="shipping-address-radio-new"
                />
                <div className="flex flex-col">
                  <span className="text-left font-semibold text-ui-fg-interactive flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    {t("checkout.new_shipping_address")}
                  </span>
                  <span className="text-left text-xs text-ui-fg-muted">
                    Nhập địa chỉ nhận hàng khác cho đơn hàng này
                  </span>
                </div>
              </div>
            </Listbox.Option>

            {/* Saved Addresses */}
            {addresses.map((address) => {
              const isSelected = selectedAddress?.id === address.id
              return (
                <Listbox.Option
                  key={address.id}
                  value={address.id}
                  className={({ active }) =>
                    clx(
                      "cursor-pointer select-none relative px-4 py-3 transition-colors",
                      active ? "bg-ui-bg-subtle-hover" : "bg-white",
                      isSelected && "bg-ui-bg-subtle"
                    )
                  }
                  data-testid="shipping-address-option"
                >
                  <div className="flex gap-x-3 items-start">
                    <Radio
                      checked={isSelected}
                      data-testid="shipping-address-radio"
                      className="mt-0.5"
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-left font-semibold text-ui-fg-base">
                          {address.first_name} {address.last_name}
                        </span>
                        {address.phone && (
                          <span className="text-xs text-ui-fg-muted font-medium">
                            📞 {address.phone}
                          </span>
                        )}
                        {address.is_default_shipping && (
                          <Badge size="small" color="blue">
                            {t("checkout.default_badge")}
                          </Badge>
                        )}
                      </div>
                      {address.company && (
                        <span className="text-xs text-ui-fg-muted mt-0.5">
                          {address.company}
                        </span>
                      )}
                      <div className="flex flex-col text-left text-xs text-ui-fg-subtle mt-1 space-y-0.5">
                        <span>
                          {address.address_1}
                          {address.address_2 && <span>, {address.address_2}</span>}
                        </span>
                        <span>
                          {address.city && `${address.city}, `}
                          {address.province && `${address.province}, `}
                          {address.country_code?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Listbox.Option>
              )
            })}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
}

export default AddressSelect

