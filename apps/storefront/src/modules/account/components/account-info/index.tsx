"use client"

import { Badge, Button } from "@modules/common/components/ui"
import { useEffect } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import { useFormStatus } from "react-dom"
import { useTranslation } from "@lib/i18n/client"

type AccountInfoProps = {
  label: string
  currentInfo: string | React.ReactNode
  isSuccess?: boolean
  isError?: boolean
  errorMessage?: string
  clearState?: () => void
  children?: React.ReactNode
  isEditable?: boolean
  'data-testid'?: string
}

const AccountInfo = ({
  label,
  currentInfo,
  isSuccess,
  isError,
  clearState,
  errorMessage,
  children,
  isEditable = true,
  'data-testid': dataTestid
}: AccountInfoProps) => {
  const t = useTranslation()
  const { state, close, open } = useToggleState()

  const { pending } = useFormStatus()

  const handleToggle = () => {
    clearState?.()

    if (state) {
      close()
      return
    }

    open()
  }

  useEffect(() => {
    if (isSuccess) {
      close()
    }
  }, [isSuccess, close])

  return (
    <div className="text-small-regular" data-testid={dataTestid}>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="uppercase text-ui-fg-base">{label}</span>
          <div className="flex items-center flex-1 basis-0 justify-end gap-x-4">
            {typeof currentInfo === "string" ? (
              <span className="font-semibold" data-testid="current-info">{currentInfo}</span>
            ) : (
              currentInfo
            )}
          </div>
        </div>
        {isEditable && children && (
          <Button
            variant="secondary"
            className="w-[100px] min-h-[25px] py-1"
            onClick={handleToggle}
            type="button"
            data-testid="edit-button"
            data-active={state}
          >
            {state ? t("account.cancel") : t("account.edit")}
          </Button>
        )}
      </div>

      {isSuccess && (
        <div data-testid="success-message">
          <Badge className="p-2 my-4" color="green">
            <span>{t("account.updated", { label })}</span>
          </Badge>
        </div>
      )}

      {isError && (
        <div data-testid="error-message">
          <Badge className="p-2 my-4" color="red">
            <span>{errorMessage || t("account.generic_error")}</span>
          </Badge>
        </div>
      )}

      {state && isEditable && children && (
        <div className="flex flex-col gap-y-2 py-4">
          <div>{children}</div>
          <div className="flex items-center justify-end mt-2">
            <Button
              isLoading={pending}
              className="w-full small:max-w-[140px]"
              type="submit"
              data-testid="save-button"
            >
              {t("account.save_changes")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountInfo
