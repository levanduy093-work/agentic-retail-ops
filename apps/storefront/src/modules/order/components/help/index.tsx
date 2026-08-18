"use client"

import { Heading } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"
import { useTranslation } from "@lib/i18n/client"

const Help = () => {
  const t = useTranslation()
  return (
    <div className="mt-6">
      <Heading className="text-base-semi">{t("order.need_help")}</Heading>
      <div className="text-base-regular my-2">
        <ul className="gap-y-2 flex flex-col">
          <li>
            <LocalizedClientLink
              href="/contact"
              className="text-ui-fg-subtle hover:text-ui-fg-base transition-colors"
            >
              {t("order.contact")}
            </LocalizedClientLink>
          </li>
          <li>
            <LocalizedClientLink
              href="/returns"
              className="text-ui-fg-subtle hover:text-ui-fg-base transition-colors"
            >
              {t("order.returns_exchanges")}
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help
