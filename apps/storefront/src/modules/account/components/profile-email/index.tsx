import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { getDictionary } from "@lib/i18n"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileEmail: React.FC<MyInformationProps> = async ({ customer }) => {
  const dict = await getDictionary()

  return (
    <AccountInfo
      label={dict.account.email}
      currentInfo={
        <div className="flex flex-col">
          <span className="font-semibold" data-testid="current-info">
            {customer.email}
          </span>
          <span className="text-ui-fg-subtle">
            {dict.account.email_readonly}
          </span>
        </div>
      }
      isEditable={false}
      data-testid="account-email-editor"
    />
  )
}

export default ProfileEmail
