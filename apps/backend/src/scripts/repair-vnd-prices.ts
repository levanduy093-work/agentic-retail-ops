import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

type VariantPrice = {
  amount: number
  currency_code: string
}

type ProductVariantWithPrices = {
  id: string
  sku: string | null
  price_set?: {
    prices?: VariantPrice[]
  } | null
}

const VND_PER_USD = 25000
const VND_PER_EUR = 28000
const DEFAULT_VND_PRICE = 250000

function getVndAmount(prices: VariantPrice[]) {
  const usdPrice = prices.find((price) => price.currency_code === "usd")
  if (usdPrice) {
    return Math.round(usdPrice.amount * VND_PER_USD)
  }

  const eurPrice = prices.find((price) => price.currency_code === "eur")
  if (eurPrice) {
    return Math.round(eurPrice.amount * VND_PER_EUR)
  }

  return DEFAULT_VND_PRICE
}

export async function ensureVndVariantPrices(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "sku",
      "price_set.prices.amount",
      "price_set.prices.currency_code",
    ],
  })

  const variants = data as ProductVariantWithPrices[]
  const variantsWithoutVnd = variants.filter((variant) => {
    const prices = variant.price_set?.prices || []
    return !prices.some((price) => price.currency_code === "vnd")
  })

  if (!variantsWithoutVnd.length) {
    logger.info("All product variants already have VND prices.")
    return 0
  }

  await updateProductVariantsWorkflow(container).run({
    input: {
      product_variants: variantsWithoutVnd.map((variant) => ({
        id: variant.id,
        prices: [
          {
            amount: getVndAmount(variant.price_set?.prices || []),
            currency_code: "vnd",
          },
        ],
      })),
    },
  })

  logger.info(
    `Added VND prices to ${variantsWithoutVnd.length} product variants.`,
  )
  return variantsWithoutVnd.length
}

export default async function repairVndPrices({
  container,
}: {
  container: MedusaContainer
}) {
  await ensureVndVariantPrices(container)
}
