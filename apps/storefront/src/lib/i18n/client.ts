"use client"

import en from "./dictionaries/en.json"
import vi from "./dictionaries/vi.json"
import { useParams } from "next/navigation"

type TranslationValues = Record<string, string | number>

const dictionaries = { en, vi }

export const getTranslation = (
  locale: string | undefined,
  key: string,
  values: TranslationValues = {}
) => {
  const dictionary = dictionaries[locale === "vi" ? "vi" : "en"]
  const translation = key.split(".").reduce<unknown>(
    (value, segment) =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[segment]
        : undefined,
    dictionary
  )

  if (typeof translation !== "string") return key

  return translation.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`))
}

export const useTranslation = () => {
  const { locale } = useParams<{ locale?: string }>()

  return (key: string, values?: TranslationValues) =>
    getTranslation(locale, key, values)
}
