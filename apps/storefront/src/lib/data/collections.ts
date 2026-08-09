"use server"

import { sdk } from "@lib/config"
import { decodeRouteSegment } from "@lib/util/decode-route-segment"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"
import { getRequestLocale } from "@lib/i18n/request-locale"
import { localizeCollection } from "@lib/i18n/catalog"

export const retrieveCollection = async (id: string) => {
  const locale = await getRequestLocale()
  const next = {
    ...(await getCacheOptions("collections")),
  }

  return await sdk.client
    .fetch<{ collection: HttpTypes.StoreCollection }>(
      `/store/collections/${id}`,
      {
        next,
        cache: "force-cache",
      }
    )
    .then(({ collection }) => localizeCollection(collection, locale))
}

export const listCollections = async (
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const locale = await getRequestLocale()
  const next = {
    ...(await getCacheOptions("collections")),
  }

  queryParams.limit = queryParams.limit || "100"
  queryParams.offset = queryParams.offset || "0"

  return await sdk.client
    .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
      "/store/collections",
      {
        query: queryParams,
        next,
        cache: "force-cache",
      }
    )
    .then(({ collections }) => ({
      collections: collections.map((collection) =>
        localizeCollection(collection, locale)
      ),
      count: collections.length,
    }))
}

export const getCollectionByHandle = async (
  handle: string
): Promise<HttpTypes.StoreCollection | null> => {
  const decodedHandle = decodeRouteSegment(handle)
  const locale = await getRequestLocale()
  const next = {
    ...(await getCacheOptions("collections")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
      query: { handle: decodedHandle, fields: "*products" },
      next,
      cache: "force-cache",
    })
    .then(({ collections }) => {
      const collection = collections[0]

      return collection ? localizeCollection(collection, locale) : null
    })
}
