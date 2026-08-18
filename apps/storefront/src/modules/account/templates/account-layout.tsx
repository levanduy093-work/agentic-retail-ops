import React from "react"

import UnderlineLink from "@modules/common/components/interactive-link"
import { getDictionary } from "@lib/i18n"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = async ({
  customer,
  children,
}) => {
  const dict = await getDictionary()

  return (
    <div className="flex-1 small:py-12" data-testid="account-page">
      <div className="flex-1 content-container h-full max-w-5xl mx-auto bg-white flex flex-col">
        <div className="grid grid-cols-1  small:grid-cols-[240px_1fr] py-12">
          <div>{customer && <AccountNav customer={customer} />}</div>
          <div className="flex-1">{children}</div>
        </div>
        <div className="flex flex-col small:flex-row items-end justify-between small:border-t border-gray-200 py-12 gap-8">
          <div>
            <h3 className="text-xl-semi mb-4">{dict.account.help_title}</h3>
            <span className="txt-medium">
              {dict.account.help_description}
            </span>
          </div>
          <div>
            <UnderlineLink href="/contact">
              {dict.account.customer_service}
            </UnderlineLink>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout
