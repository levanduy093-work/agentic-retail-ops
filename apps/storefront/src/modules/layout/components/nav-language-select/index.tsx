"use client"

import { setLocaleCookie } from "@lib/data/locale-actions"
import { useRouter } from "next/navigation"
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
  const [isPending, startTransition] = useTransition()
  const activeLocale = currentLocale === "vi" ? "vi" : "en"

  const selectLanguage = (locale: "en" | "vi") => {
    if (locale === activeLocale) return

    startTransition(async () => {
      await setLocaleCookie(locale)
      router.refresh()
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
