"use client"

import { ChevronDownMini } from "@medusajs/icons"
import { decodeRouteSegment } from "@lib/util/decode-route-segment"
import { startStorefrontNavigation } from "@lib/util/storefront-navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export type CatalogCategory = {
  id: string
  handle: string
  name: string
  children: CatalogCategory[]
}

export type CatalogCollection = {
  id: string
  handle: string
  title: string
}

type CatalogNavigationProps = {
  categories: CatalogCategory[]
  collections: CatalogCollection[]
  categoryLabel: string
  collectionLabel: string
}

const dropdownButtonClassName =
  "relative z-[1] flex h-10 cursor-pointer list-none items-center gap-1 rounded-full px-3 font-medium text-[#315248] transition-[color,background-color,transform] duration-100 marker:hidden hover:bg-white/65 hover:text-[#103a2f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#174b3d]/45 active:scale-[0.98] motion-reduce:transition-none [&::-webkit-details-marker]:hidden"

const dropdownPanelClassName =
  "absolute left-0 top-full z-[60] mt-3 rounded-[20px] border border-[#12231d]/10 bg-white p-3 text-[#315248] shadow-[0_18px_55px_rgba(17,49,39,0.14)]"

export default function CatalogNavigation({
  categories,
  collections,
  categoryLabel,
  collectionLabel,
}: CatalogNavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const categoryDetails = useRef<HTMLDetailsElement | null>(null)
  const collectionDetails = useRef<HTMLDetailsElement | null>(null)
  const prefetchTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  )
  const { countryCode, locale } = useParams<{
    countryCode?: string
    locale?: string
  }>()

  const getLocalizedHref = (href: string) =>
    `/${locale || "en"}/${countryCode || "dk"}${href}`

  const prefetch = (href: string) => {
    router.prefetch(getLocalizedHref(href))
  }

  const schedulePrefetch = (href: string) => {
    if (prefetchTimers.current.has(href)) {
      return
    }

    const timer = setTimeout(() => {
      prefetch(href)
      prefetchTimers.current.delete(href)
    }, 60)

    prefetchTimers.current.set(href, timer)
  }

  const cancelScheduledPrefetch = (href: string) => {
    const timer = prefetchTimers.current.get(href)

    if (timer) {
      clearTimeout(timer)
      prefetchTimers.current.delete(href)
    }
  }

  const startSelection = (
    href: string,
    details: React.RefObject<HTMLDetailsElement | null>
  ) => {
    setPendingHref(href)
    startStorefrontNavigation()

    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
    }

    closeTimer.current = setTimeout(() => {
      details.current?.removeAttribute("open")
    }, 160)
  }

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node

      if (
        !categoryDetails.current?.contains(target) &&
        !collectionDetails.current?.contains(target)
      ) {
        categoryDetails.current?.removeAttribute("open")
        collectionDetails.current?.removeAttribute("open")
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        categoryDetails.current?.removeAttribute("open")
        collectionDetails.current?.removeAttribute("open")
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer)
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer)
      document.removeEventListener("keydown", closeOnEscape)

      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
      }

      prefetchTimers.current.forEach(clearTimeout)
      prefetchTimers.current.clear()
    }
  }, [])

  if (!categories.length && !collections.length) {
    return null
  }

  const isCurrent = (href: string) =>
    decodeRouteSegment(pathname) === getLocalizedHref(href).normalize("NFC")

  const getLinkClassName = (href: string, compact = false) =>
    [
      "block font-semibold text-[#174b3d] transition-[color,background-color,transform] duration-150 hover:bg-[#edf3ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174b3d]/35 active:scale-[0.98] motion-reduce:transition-none",
      compact ? "rounded-lg py-1.5 text-sm" : "rounded-xl px-3 py-2.5",
      isCurrent(href) ? "bg-[#e5eee8] text-[#103a2f]" : "",
    ].join(" ")

  return (
    <div className="hidden shrink-0 items-center gap-1 small:flex">
      {!!categories.length && (
        <details
          ref={categoryDetails}
          name="catalog-navigation"
          className="group relative"
        >
          <summary role="button" className={dropdownButtonClassName}>
            {categoryLabel}
            <ChevronDownMini className="transition-transform duration-100 group-open:rotate-180" />
          </summary>
          <div className={`${dropdownPanelClassName} w-[340px]`}>
            <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#718078]">
              {categoryLabel}
            </div>
            <ul className="grid grid-cols-2 gap-1">
              {categories.map((category) => {
                const href = `/categories/${category.handle}`

                return (
                  <li key={category.id}>
                    <LocalizedClientLink
                      href={href}
                      onClick={() => startSelection(href, categoryDetails)}
                      onPointerEnter={() => schedulePrefetch(href)}
                      onPointerLeave={() => cancelScheduledPrefetch(href)}
                      onFocus={() => prefetch(href)}
                      aria-current={isCurrent(href) ? "page" : undefined}
                      aria-busy={pendingHref === href}
                      className={getLinkClassName(href)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        {category.name}
                        {pendingHref === href && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </LocalizedClientLink>
                    {!!category.children.length && (
                      <ul className="mb-2 space-y-0.5 px-3">
                        {category.children.slice(0, 4).map((child) => {
                          const childHref = `/categories/${child.handle}`

                          return (
                            <li key={child.id}>
                              <LocalizedClientLink
                                href={childHref}
                                onClick={() =>
                                  startSelection(childHref, categoryDetails)
                                }
                                onPointerEnter={() =>
                                  schedulePrefetch(childHref)
                                }
                                onPointerLeave={() =>
                                  cancelScheduledPrefetch(childHref)
                                }
                                onFocus={() => prefetch(childHref)}
                                aria-current={
                                  isCurrent(childHref) ? "page" : undefined
                                }
                                className={`${getLinkClassName(
                                  childHref,
                                  true
                                )} px-1 text-[#60716a] hover:text-[#174b3d]`}
                              >
                                {child.name}
                              </LocalizedClientLink>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </details>
      )}

      {!!collections.length && (
        <details
          ref={collectionDetails}
          name="catalog-navigation"
          className="group relative"
        >
          <summary role="button" className={dropdownButtonClassName}>
            {collectionLabel}
            <ChevronDownMini className="transition-transform duration-100 group-open:rotate-180" />
          </summary>
          <div className={`${dropdownPanelClassName} w-[280px]`}>
            <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#718078]">
              {collectionLabel}
            </div>
            <ul className="space-y-1">
              {collections.map((collection) => {
                const href = `/collections/${collection.handle}`

                return (
                  <li key={collection.id}>
                    <LocalizedClientLink
                      href={href}
                      onClick={() => startSelection(href, collectionDetails)}
                      onPointerEnter={() => schedulePrefetch(href)}
                      onPointerLeave={() => cancelScheduledPrefetch(href)}
                      onFocus={() => prefetch(href)}
                      aria-current={isCurrent(href) ? "page" : undefined}
                      aria-busy={pendingHref === href}
                      className={getLinkClassName(href)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        {collection.title}
                        {pendingHref === href && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </LocalizedClientLink>
                  </li>
                )
              })}
            </ul>
          </div>
        </details>
      )}
    </div>
  )
}
