import { Checkbox, Label } from "@modules/common/components/ui"
import React from "react"

type CheckboxProps = {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: () => void
  label: string
  name?: string
  id?: string
  'data-testid'?: string
}

const CheckboxWithLabel: React.FC<CheckboxProps> = ({
  checked,
  defaultChecked,
  onChange,
  label,
  name,
  id,
  'data-testid': dataTestId,
}) => {
  const checkboxId = id || name || "checkbox"
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        className="text-base-regular flex items-center gap-x-2 cursor-pointer"
        id={checkboxId}
        role="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        aria-checked={checked ?? defaultChecked}
        onChange={onChange}
        onClick={onChange}
        name={name}
        data-testid={dataTestId}
      />
      <Label
        htmlFor={checkboxId}
        className="!transform-none !txt-medium cursor-pointer select-none text-sm text-ui-fg-base"
      >
        {label}
      </Label>
    </div>
  )
}

export default CheckboxWithLabel
