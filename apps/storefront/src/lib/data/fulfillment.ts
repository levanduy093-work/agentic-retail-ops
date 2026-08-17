"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders } from "./cookies"

export const listCartShippingMethods = async (cartId: string) => {
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
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(() => {
      return null
    })
}

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const packing = await sdk.client
    .fetch<{
      packages: Array<{
        height: number
        length: number
        weight: number
        width: number
      }>
      total_weight: number
    }>("/store/shipping-packages", {
      method: "POST",
      body: { cart_id: cartId },
      headers,
      cache: "no-store",
    })
    .catch(() => null)

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
      }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch((_e) => {
      return null
    })
}
