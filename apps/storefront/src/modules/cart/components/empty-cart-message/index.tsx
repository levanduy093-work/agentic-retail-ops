"use client"

import { Heading, Text } from "@modules/common/components/ui"
import InteractiveLink from "@modules/common/components/interactive-link"
import { useTranslation } from "@lib/i18n/client"

const EmptyCartMessage = () => {
  const t = useTranslation()

  return (
    <div className="py-48 px-2 flex flex-col justify-center items-start" data-testid="empty-cart-message">
      <Heading
        level="h1"
        className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
      >
        {t("cart.title")}
      </Heading>
      <Text className="text-base-regular mt-4 mb-6 max-w-[32rem]">
        {t("cart.empty")}
      </Text>
      <div>
        <InteractiveLink href="/store">{t("cart.explore")}</InteractiveLink>
      </div>
    </div>
  )
}

export default EmptyCartMessage
