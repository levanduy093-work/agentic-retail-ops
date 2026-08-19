import { InformationCircleSolid } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"

type ErrorMessageProps = {
  error?: string | null
  "data-testid"?: string
  className?: string
}

const ErrorMessage = ({
  error,
  "data-testid": dataTestid,
  className,
}: ErrorMessageProps) => {
  if (!error) {
    return null
  }

  return (
    <div
      className={clx(
        "mt-3 w-full rounded-xl bg-amber-50/80 border border-amber-200/70 p-3 text-xs flex items-start gap-2.5 text-amber-900 leading-relaxed animate-fadeIn",
        className
      )}
      data-testid={dataTestid}
    >
      <InformationCircleSolid className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <span className="flex-1 font-normal">{error}</span>
    </div>
  )
}

export default ErrorMessage
