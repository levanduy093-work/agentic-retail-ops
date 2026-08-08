"use client"

import { setLocaleCookie } from "@lib/data/locale-actions"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

const languages = [
  { code: "en", label: "EN", title: "English" },
  { code: "vi", label: "VI", title: "Tiếng Việt" },
] as const

type NavLanguageSelectProps = {
  currentLocale: string | null
}

export default function NavLanguageSelect({
  currentLocale,
}: NavLanguageSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const pathLocale = pathname.split("/").filter(Boolean)[0]
  const activeLocale =
    pathLocale === "vi" || pathLocale === "en"
      ? pathLocale
      : currentLocale === "vi"
      ? "vi"
      : "en"

  const selectLanguage = (locale: "en" | "vi") => {
    if (locale === activeLocale) return

    startTransition(() => {
      const pathSegments = pathname.split("/").filter(Boolean)

      if (pathSegments[0] === "en" || pathSegments[0] === "vi") {
        pathSegments[0] = locale
      } else {
        pathSegments.unshift(locale)
      }

      const queryString = searchParams.toString()
      const href = `/${pathSegments.join("/")}${
        queryString ? `?${queryString}` : ""
      }`

      // The URL is the canonical locale state. Replacing it prevents language
      // changes from building a history chain that appears to toggle back and forth.
      router.replace(href)

      void setLocaleCookie(locale)
    })
  }

  return (
    <div
      className="relative z-[1] flex shrink-0 items-center rounded-full border border-[#d7e2dc] bg-white/65 p-1"
      aria-label="Language"
    >
      {languages.map((language) => {
        const isActive = language.code === activeLocale

        return (
          <button
            key={language.code}
            type="button"
            title={language.title}
            aria-pressed={isActive}
            disabled={isPending}
            onClick={() => selectLanguage(language.code)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] transition-colors disabled:cursor-wait ${
              isActive
                ? "bg-[#174b3d] text-white shadow-sm"
                : "text-[#527067] hover:bg-white hover:text-[#174b3d]"
            }`}
          >
            {isPending && !isActive ? "…" : language.label}
          </button>
        )
      })}
    </div>
  )
}
