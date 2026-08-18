import { Suspense } from "react"

import { OptionValueIds } from "@lib/util/product-option-filters"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"
import { getDictionary } from "@lib/i18n"

const StoreTemplate = async ({
  sortBy,
  page,
  query,
  countryCode,
  optionValueIds,
}: {
  sortBy?: SortOptions
  page?: string
  query?: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const dict = await getDictionary()

  return (
    <div className="flex flex-col">
      <div className="content-container pt-6 small:pt-10">
        <div className="liquid-glass-web-approx rounded-[26px] px-6 py-12 small:px-12 small:py-16">
          <h1 className="mb-3 max-w-2xl text-4xl font-semibold tracking-[-0.06em] text-[#12231d] small:text-5xl" data-testid="store-page-title">
            {query
              ? dict.store.results_for?.replace("{query}", query) || `Results for “${query}”`
              : dict.store.title}
          </h1>
          <p className="max-w-xl text-base leading-7 text-[#5e7068]">
            {dict.store.subtitle}
          </p>
        </div>
      </div>
      <div
        className="content-container flex flex-col gap-x-12 py-8 small:flex-row small:items-start small:py-12"
        data-testid="category-container"
      >
        <div className="w-full small:w-[250px] shrink-0 small:border-r border-ui-border-base pr-4">
          <RefinementList sortBy={sort} />
        </div>
        <div className="w-full flex-1">
          <Suspense fallback={<SkeletonProductGrid />}>
            <PaginatedProducts
              sortBy={sort}
              page={pageNumber}
              countryCode={countryCode}
              optionValueIds={optionValueIds}
              query={query}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
