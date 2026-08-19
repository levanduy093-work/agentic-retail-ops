"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders } from "./cookies"

export type ShippingPackage = {
  height: number
  length: number
  weight: number
  width: number
}

export type ShippingQuote = {
  option: HttpTypes.StoreCartShippingOption
  packages: ShippingPackage[]
  totalWeight: number
}

export const listCartShippingMethods = async (cartId: string) => {
  if (!cartId) {
    return []
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        method: "GET",
        query: {
          cart_id: cartId,
        },
        headers,
        cache: "no-store",
      },
    )
    .then(({ shipping_options }) => shipping_options || [])
    .catch((err) => {
      console.error("[listCartShippingMethods] Error fetching shipping options:", err)
      return []
    })
}

export const getShippingPackages = async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{
      packages: ShippingPackage[]
      total_weight: number
    }>("/store/shipping-packages", {
      method: "POST",
      body: { cart_id: cartId },
      headers,
      cache: "no-store",
    })
    .catch(() => null)
}

export const calculateShippingQuote = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>,
): Promise<ShippingQuote | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const packing = await getShippingPackages(cartId)

  const body = {
    cart_id: cartId,
    data: {
      cart_id: cartId,
      ghn_weight: packing?.total_weight || 300,
      shipping_packages: packing?.packages,
      ...data,
    },
  }

  return sdk.client
    .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      {
        method: "POST",
        body,
        headers,
        cache: "no-store",
      },
    )
    .then(({ shipping_option }) => ({
      option: shipping_option,
      packages: packing?.packages || [],
      totalWeight: packing?.total_weight || 300,
    }))
    .catch((_e) => {
      return null
    })
}

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>,
) => {
  const quote = await calculateShippingQuote(optionId, cartId, data)
  return quote?.option || null
}
