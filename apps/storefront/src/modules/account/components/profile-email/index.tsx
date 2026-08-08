import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileEmail: React.FC<MyInformationProps> = ({ customer }) => {
  return (
    <AccountInfo
      label="Email"
      currentInfo={
        <div className="flex flex-col">
          <span className="font-semibold" data-testid="current-info">
            {customer.email}
          </span>
          <span className="text-ui-fg-subtle">
            Used to sign in and cannot be changed here.
          </span>
        </div>
      }
      isEditable={false}
      data-testid="account-email-editor"
    />
  )
}

export default ProfileEmail
