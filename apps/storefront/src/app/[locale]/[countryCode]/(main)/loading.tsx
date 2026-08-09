import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

export default function MainLoading() {
  return (
    <main className="content-container min-h-[55vh] py-10 small:py-16">
      <div className="mb-10 h-9 w-52 animate-pulse rounded-md bg-gray-100" />
      <SkeletonProductGrid numberOfProducts={8} />
    </main>
  )
}
