"use client"

import InteractiveLink from "@modules/common/components/interactive-link"
import { useTranslation } from "@lib/i18n/client"

export default function NotFound() {
  const t = useTranslation()
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("common.page_not_found")}</h1>
      <p className="text-small-regular text-ui-fg-base">
        {t("common.page_not_found_desc")}
      </p>
      <InteractiveLink href="/">{t("common.go_to_frontpage")}</InteractiveLink>
    </div>
  )
}
