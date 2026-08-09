import { sdk } from "@lib/config"
import { decodeRouteSegment } from "@lib/util/decode-route-segment"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"
import { getRequestLocale } from "@lib/i18n/request-locale"
import { localizeCategory } from "@lib/i18n/catalog"

export const listCategories = async (query?: Record<string, unknown>) => {
  const locale = await getRequestLocale()
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) =>
      product_categories.map((category) => localizeCategory(category, locale))
    )
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = categoryHandle.map(decodeRouteSegment).join("/")
  const locale = await getRequestLocale()

  const next = {
    ...(await getCacheOptions("categories")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => {
      const category = product_categories[0]

      return category ? localizeCategory(category, locale) : category
    })
}
