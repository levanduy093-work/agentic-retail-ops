import "server-only"

import { cookies as nextCookies, headers as nextHeaders } from "next/headers"

const LOCALE_COOKIE_NAME = "_medusa_locale"

export const getRequestLocale = async (): Promise<string | null> => {
  try {
    const headers = await nextHeaders()
    const requestLocale = headers.get("x-storefront-locale")

    if (requestLocale === "en" || requestLocale === "vi") {
      return requestLocale
    }

    const cookies = await nextCookies()

    return cookies.get(LOCALE_COOKIE_NAME)?.value ?? null
  } catch {
    return null
  }
}
