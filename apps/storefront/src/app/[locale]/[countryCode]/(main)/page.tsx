import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { getDictionary } from "@lib/i18n"
import { listProducts } from "@lib/data/products"

export const metadata: Metadata = {
  title: "Synapse Store",
  description:
    "A performant frontend ecommerce starter template with Next.js 15 and Synapse.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const [region, dict, { collections }] = await Promise.all([
    getRegion(countryCode),
    getDictionary(),
    listCollections({
      fields: "id,handle,title",
      limit: "3",
    }),
  ])

  if (!collections || !region) {
    return null
  }

  const heroProducts = await listProducts({
    regionId: region.id,
    queryParams: { limit: 1, fields: "id,handle,title,thumbnail,images" },
  })

  return (
    <>
      <Hero product={heroProducts.response.products[0]} dict={dict} />
      <div className="py-8 small:py-14">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
