import { Suspense } from "react"

import { OptionValueIds } from "@lib/util/product-option-filters"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = ({
  sortBy,
  page,
  countryCode,
  optionValueIds,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div className="flex flex-col">
      <div className="w-full bg-ui-bg-subtle border-b border-ui-border-base py-16">
        <div className="content-container flex flex-col items-center text-center">
          <h1 className="text-4xl-semi md:text-5xl font-bold tracking-tight text-ui-fg-base mb-4" data-testid="store-page-title">
            Our Collection
          </h1>
          <p className="text-ui-fg-subtle max-w-lg text-lg">
            Discover our premium selection of carefully curated products designed for modern living.
          </p>
        </div>
      </div>
      <div
        className="flex flex-col small:flex-row small:items-start py-8 content-container gap-x-12"
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
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
