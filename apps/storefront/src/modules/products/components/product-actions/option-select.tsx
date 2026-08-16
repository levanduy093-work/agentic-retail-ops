import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "@lib/i18n/client"
import { clx } from "@modules/common/components/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  availability?: Record<string, boolean>
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
  availability,
}) => {
  const t = useTranslation()
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm">Select {title}</span>
      <div
        className="flex flex-wrap justify-between gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          const unavailable = availability?.[v] === false

          return (
            <button
              onClick={() => updateOption(option.id, v)}
              key={v}
              className={clx(
                "border-ui-border-base bg-ui-bg-subtle border text-small-regular h-10 rounded-rounded p-2 flex-1 ",
                {
                  "border-ui-border-interactive": v === current,
                  "cursor-not-allowed opacity-40": unavailable,
                  "hover:shadow-elevation-card-rest transition-shadow ease-in-out duration-150":
                    v !== current && !unavailable,
                }
              )}
              disabled={disabled || unavailable}
              data-testid="option-button"
              title={unavailable ? t("product.out_of_stock") : undefined}
            >
              {v}
              {unavailable && (
                <span className="sr-only"> {t("product.out_of_stock")}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
