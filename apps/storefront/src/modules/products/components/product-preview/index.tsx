import { Text } from "@modules/common/components/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default function ProductPreview({
  product,
  isFeatured,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group flex h-full"
    >
      <div
        data-testid="product-wrapper"
        className="flex w-full flex-col overflow-hidden rounded-large border border-[color:var(--line)] bg-white transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_44px_rgba(17,49,39,0.12)]"
      >
        <div className="flex-grow bg-[#eef3f0]">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            className="rounded-none border-0 shadow-none group-hover:shadow-none"
          />
        </div>
        <div className="flex flex-col gap-2 p-5 pt-4">
          <Text
            className="truncate text-base font-semibold tracking-[-0.02em] text-[#12231d]"
            data-testid="product-title"
            title={product.title}
          >
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2 font-semibold text-[#174b3d]">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
