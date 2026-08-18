import { Button, Container, Text } from "@modules/common/components/ui"
import { cookies as nextCookies } from "next/headers"
import { getDictionary } from "@lib/i18n"

async function ProductOnboardingCta() {
  const [cookies, dict] = await Promise.all([nextCookies(), getDictionary()])

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"

  if (!isOnboarding) {
    return null
  }

  return (
    <Container className="max-w-4xl h-full bg-ui-bg-subtle w-full p-8">
      <div className="flex flex-col gap-y-4 center">
        <Text className="text-ui-fg-base text-xl">
          {dict.product.demo_product_created}
        </Text>
        <Text className="text-ui-fg-subtle text-small-regular">
          {dict.product.continue_setup_admin_desc}
        </Text>
        <a href="http://localhost:7001/a/orders?onboarding_step=create_order_nextjs">
          <Button className="w-full">{dict.product.continue_setup_admin}</Button>
        </a>
      </div>
    </Container>
  )
}

export default ProductOnboardingCta
