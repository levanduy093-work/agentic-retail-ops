import { Metadata } from "next"
import { notFound } from "next/navigation"

import AddressBook from "@modules/account/components/address-book"

import { getRegion } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"

export const metadata: Metadata = {
  title: "Addresses",
  description: "View your addresses",
}

export default async function Addresses(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params
  const [customer, region, dict] = await Promise.all([
    retrieveCustomer(),
    getRegion(countryCode),
    getDictionary(),
  ])

  if (!customer || !region) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="addresses-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">{dict.account.shipping_addresses}</h1>
        <p className="text-base-regular">
          {dict.account.addresses_description}
        </p>
      </div>
      <AddressBook customer={customer} region={region} />
    </div>
  )
}
