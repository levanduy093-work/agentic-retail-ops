import { Text } from "@modules/common/components/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region: _region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  // const pricedProduct = await listProducts({
  //   regionId: region.id,
  //   queryParams: { id: [product.id!] },
  // }).then(({ response }) => response.products[0])

  // if (!pricedProduct) {
  //   return null
  // }

  const { cheapestPrice } = getProductPrice({
    product,
  })

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group h-full flex">
      <div data-testid="product-wrapper" className="flex flex-col w-full bg-white border border-ui-border-base rounded-large overflow-hidden transition-shadow duration-200 group-hover:shadow-elevation-card-hover group-hover:border-transparent">
        <div className="flex-grow">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            className="rounded-none shadow-none border-b border-ui-border-base group-hover:shadow-none"
          />
        </div>
        <div className="flex flex-col gap-2 p-4 pt-3 bg-white">
          <Text className="text-ui-fg-base font-semibold truncate" data-testid="product-title" title={product.title}>
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2 text-ui-fg-interactive font-medium">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
