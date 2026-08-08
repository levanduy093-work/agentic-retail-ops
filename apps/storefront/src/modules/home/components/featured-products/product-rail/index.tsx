import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

import InteractiveLink from "@modules/common/components/interactive-link"
import ProductPreview from "@modules/products/components/product-preview"
import { getDictionary } from "@lib/i18n"

export default async function ProductRail({
  collection,
  region,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
}) {
  const {
    response: { products: pricedProducts },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      collection_id: collection.id,
      limit: 4,
      fields: "id,handle,title,thumbnail,*variants.calculated_price",
    },
  })
  const dict = await getDictionary()

  if (!pricedProducts) {
    return null
  }

  return (
    <div className="content-container py-10 small:py-16">
      <div className="mb-7 flex items-end justify-between gap-4">
        <Text className="text-2xl font-semibold tracking-[-0.04em] text-[#12231d] small:text-3xl">{collection.title}</Text>
        <InteractiveLink href={`/collections/${collection.handle}`}>
          <span className="text-sm font-semibold text-[#174b3d]">{dict?.collection?.view_all || "View all"}</span>
        </InteractiveLink>
      </div>
      <ul className="grid grid-cols-2 gap-4 small:grid-cols-3 small:gap-6">
        {pricedProducts &&
          pricedProducts.map((product) => (
            <li key={product.id}>
              <ProductPreview product={product} region={region} isFeatured />
            </li>
          ))}
      </ul>
    </div>
  )
}
