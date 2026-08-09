"use client"

import InteractiveLink from "@modules/common/components/interactive-link"
import { useTranslation } from "@lib/i18n/client"

export default function NotFound() {
  const t = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("common.cart_not_found")}</h1>
      <p className="text-small-regular text-ui-fg-base">
        {t("common.cart_not_found_desc")}
      </p>
      <InteractiveLink href="/">{t("common.go_to_frontpage")}</InteractiveLink>
    </div>
  )
}
