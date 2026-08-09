"use client"

import { clx } from "@modules/common/components/ui"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { startStorefrontNavigation } from "@lib/util/storefront-navigation"

export function Pagination({
  page,
  totalPages,
  "data-testid": dataTestid,
}: {
  page: number
  totalPages: number
  "data-testid"?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Helper function to generate an array of numbers within a range
  const arrayRange = (start: number, stop: number) =>
    Array.from({ length: stop - start + 1 }, (_, index) => start + index)

  const getPageHref = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())

    return `${pathname}?${params.toString()}`
  }

  // Function to render a page control
  const renderPageButton = (
    p: number,
    label: string | number,
    isCurrent: boolean
  ) => {
    const className = clx(
      "flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-large-semi transition-colors duration-200",
      {
        "bg-[var(--brand)] text-white shadow-sm": isCurrent,
        "text-[var(--muted)] hover:bg-white hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]":
          !isCurrent,
      }
    )

    if (isCurrent) {
      return (
        <span key={p} aria-current="page" className={className}>
          {label}
        </span>
      )
    }

    return (
      <Link
        key={p}
        href={getPageHref(p)}
        aria-label={`Go to page ${p}`}
        className={className}
        onClick={startStorefrontNavigation}
        scroll
      >
        {label}
      </Link>
    )
  }

  // Function to render ellipsis
  const renderEllipsis = (key: string) => (
    <span
      key={key}
      aria-hidden="true"
      className="flex h-11 min-w-6 cursor-default items-center justify-center text-large-semi text-[var(--muted)]"
    >
      ...
    </span>
  )

  // Function to render page buttons based on the current page and total pages
  const renderPageButtons = () => {
    const buttons = []

    if (totalPages <= 7) {
      // Show all pages
      buttons.push(
        ...arrayRange(1, totalPages).map((p) =>
          renderPageButton(p, p, p === page)
        )
      )
    } else {
      // Handle different cases for displaying pages and ellipses
      if (page <= 4) {
        // Show 1, 2, 3, 4, 5, ..., lastpage
        buttons.push(
          ...arrayRange(1, 5).map((p) => renderPageButton(p, p, p === page))
        )
        buttons.push(renderEllipsis("ellipsis1"))
        buttons.push(
          renderPageButton(totalPages, totalPages, totalPages === page)
        )
      } else if (page >= totalPages - 3) {
        // Show 1, ..., lastpage - 4, lastpage - 3, lastpage - 2, lastpage - 1, lastpage
        buttons.push(renderPageButton(1, 1, 1 === page))
        buttons.push(renderEllipsis("ellipsis2"))
        buttons.push(
          ...arrayRange(totalPages - 4, totalPages).map((p) =>
            renderPageButton(p, p, p === page)
          )
        )
      } else {
        // Show 1, ..., page - 1, page, page + 1, ..., lastpage
        buttons.push(renderPageButton(1, 1, 1 === page))
        buttons.push(renderEllipsis("ellipsis3"))
        buttons.push(
          ...arrayRange(page - 1, page + 1).map((p) =>
            renderPageButton(p, p, p === page)
          )
        )
        buttons.push(renderEllipsis("ellipsis4"))
        buttons.push(
          renderPageButton(totalPages, totalPages, totalPages === page)
        )
      }
    }

    return buttons
  }

  // Render the component
  return (
    <nav
      aria-label="Product pagination"
      className="mt-12 flex w-full justify-center"
    >
      <div className="flex items-center gap-1" data-testid={dataTestid}>
        {renderPageButtons()}
      </div>
    </nav>
  )
}
