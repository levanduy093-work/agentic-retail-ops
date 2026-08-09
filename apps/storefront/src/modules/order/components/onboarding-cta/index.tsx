"use client"

import { resetOnboardingState } from "@lib/data/onboarding"
import { Button, Container, Text } from "@modules/common/components/ui"
import { useTranslation } from "@lib/i18n/client"

const OnboardingCta = ({ orderId }: { orderId: string }) => {
  const t = useTranslation()
  return (
    <Container className="max-w-4xl h-full bg-ui-bg-subtle w-full">
      <div className="flex flex-col gap-y-4 center p-4 md:items-center">
        <Text className="text-ui-fg-base text-xl">
          Your test order was successfully created! 🎉
        </Text>
        <Text className="text-ui-fg-subtle text-small-regular">
          {t("order.complete_setup_admin_desc")}
        </Text>
        <Button
          className="w-fit"
          size="large"
          onClick={() => resetOnboardingState(orderId)}
        >
          {t("order.complete_setup_admin")}
        </Button>
      </div>
    </Container>
  )
}

export default OnboardingCta
