"use client"

import { MagnifyingGlass } from "@medusajs/icons"
import { FormEvent, useState } from "react"
import { useParams, useRouter } from "next/navigation"

export default function CatalogSearch({ dict }: { dict?: Record<string, Record<string, string>> }) {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const { countryCode, locale } = useParams<{ countryCode: string, locale: string }>()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedQuery = query.trim()
    const href = trimmedQuery
      ? `/${locale || "en"}/${countryCode}/store?q=${encodeURIComponent(trimmedQuery)}`
      : `/${locale || "en"}/${countryCode}/store`

    router.push(href)
  }

  return (
    <form
      onSubmit={submit}
      className="block min-w-0 flex-1 md:max-w-[430px]"
    >
      <label className="sr-only" htmlFor="catalog-search">
        {dict?.nav?.search || "Search the catalog"}
      </label>
      <div className="liquid-glass-web-approx flex h-10 items-center gap-2 rounded-full px-3 small:h-11 small:gap-3 small:px-4">
        <MagnifyingGlass className="relative z-[1] shrink-0 text-[#174b3d]" />
        <input
          id="catalog-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={dict?.nav?.search || "Search the catalog"}
          className="relative z-[1] w-full bg-transparent text-base small:text-sm text-[#12231d] outline-none border-transparent focus:border-transparent focus:ring-0 focus:outline-none shadow-none focus:shadow-none placeholder:text-[#718078] appearance-none"
        />
      </div>
    </form>
  )
}
