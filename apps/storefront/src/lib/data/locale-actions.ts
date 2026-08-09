"use server"

import { getRequestLocale } from "@lib/i18n/request-locale"
import { revalidateTag } from "next/cache"
import { cookies as nextCookies } from "next/headers"
import { getAuthHeaders, getCacheTag, getCartId } from "./cookies"

const LOCALE_COOKIE_NAME = "_medusa_locale"

/**
 * Gets the locale selected for the current request
 */
export const getLocale = async (): Promise<string | null> => {
  return getRequestLocale()
}

/**
 * Sets the locale cookie
 */
export const setLocaleCookie = async (locale: string) => {
  const cookies = await nextCookies()
  cookies.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, // Allow client-side access
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

/**
 * Updates the locale preference via SDK and stores in cookie.
 * Also updates the cart with the new locale if one exists.
 */
export const updateLocale = async (localeCode: string): Promise<string> => {
  await setLocaleCookie(localeCode)

  // Update cart with the new locale if a cart exists
  const cartId = await getCartId()
  if (cartId) {
    const { sdk } = await import("@lib/config")
    const headers = {
      ...(await getAuthHeaders()),
    }

    await sdk.store.cart.update(cartId, { locale: localeCode }, {}, headers)

    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) {
      revalidateTag(cartCacheTag)
    }
  }

  // Revalidate relevant caches to refresh content
  const productsCacheTag = await getCacheTag("products")
  if (productsCacheTag) {
    revalidateTag(productsCacheTag)
  }

  const categoriesCacheTag = await getCacheTag("categories")
  if (categoriesCacheTag) {
    revalidateTag(categoriesCacheTag)
  }

  const collectionsCacheTag = await getCacheTag("collections")
  if (collectionsCacheTag) {
    revalidateTag(collectionsCacheTag)
  }

  return localeCode
}
