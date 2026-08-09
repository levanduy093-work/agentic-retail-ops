import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import Product from "../product-preview"
import { getDictionary } from "@lib/i18n"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  // edit this function to define your related products logic
  const queryParams: HttpTypes.StoreProductListParams = {
    fields: "id,handle,title,thumbnail,*variants.calculated_price",
  }
  if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  }
  if (product.tags) {
    queryParams.tag_id = product.tags
      .map((t) => t.id)
      .filter(Boolean) as string[]
  }
  queryParams.is_giftcard = false

  const [products, dict] = await Promise.all([listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) => {
    return response.products.filter(
      (responseProduct) => responseProduct.id !== product.id
    )
  }), getDictionary()])

  if (!products.length) {
    return null
  }

  return (
    <div className="product-page-constraint">
      <div className="flex flex-col items-center text-center mb-16">
        <span className="text-base-regular text-gray-600 mb-6">
          {dict.product.related_products}
        </span>
        <p className="text-2xl-regular text-ui-fg-base max-w-lg">
          {dict.product.related_products_description}
        </p>
      </div>

      <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8">
        {products.map((product) => (
          <li key={product.id}>
            <Product product={product} />
          </li>
        ))}
      </ul>
    </div>
  )
}
