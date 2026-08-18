"use client"

import { Badge } from "@modules/common/components/ui"
import { useTranslation } from "@lib/i18n/client"

const PaymentTest = ({ className }: { className?: string }) => {
  const t = useTranslation()
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">{t("checkout.test_attention")}</span> {t("checkout.for_testing_only")}
    </Badge>
  )
}

export default PaymentTest
