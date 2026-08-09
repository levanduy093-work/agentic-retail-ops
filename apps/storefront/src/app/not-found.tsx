"use client"

import { ArrowUpRightMini } from "@medusajs/icons"
import { Text } from "@modules/common/components/ui"
import Link from "next/link"
import { useTranslation } from "@lib/i18n/client"

export default function NotFound() {
  const t = useTranslation()
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("common.page_not_found")}</h1>
      <p className="text-small-regular text-ui-fg-base">
        {t("common.page_not_found_desc")}
      </p>
      <Link className="flex gap-x-1 items-center group" href="/">
        <Text className="text-ui-fg-interactive">{t("common.go_to_frontpage")}</Text>
        <ArrowUpRightMini
          className="group-hover:rotate-45 ease-in-out duration-150"
          color="var(--fg-interactive)"
        />
      </Link>
    </div>
  )
}
