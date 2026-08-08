import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { listProducts } from "@lib/data/products"

export const metadata: Metadata = {
  title: "Medusa Next.js Starter Template",
  description:
    "A performant frontend ecommerce starter template with Next.js 15 and Medusa.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const [{ collections }, heroProducts] = await Promise.all([
    listCollections({
    fields: "id, handle, title",
    }),
    region
      ? listProducts({
          regionId: region.id,
          queryParams: { limit: 1, fields: "id,handle,title,thumbnail,images" },
        })
      : Promise.resolve({ response: { products: [], count: 0 }, nextPage: null }),
  ])

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero product={heroProducts.response.products[0]} />
      <div className="py-8 small:py-14">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
