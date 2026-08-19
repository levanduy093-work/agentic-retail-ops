"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { isSameAddress } from "@lib/util/compare-addresses"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { getLocale } from "./locale-actions"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { retrieveCustomer, saveCustomerShippingAddress } from "./customer"
import {
  calculateShippingQuote,
  listCartShippingMethods,
} from "./fulfillment"
import { getRegion } from "./regions"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(cartId?: string, fields?: string) {
  const id = cartId || (await getCartId())
  fields ??=
    "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name, +shipping_methods.shipping_option_id, +shipping_methods.amount, +shipping_methods.data, +shipping_address.metadata, +billing_address.metadata, *payment_collection.payment_sessions"

  if (!id) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        fields,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(() => null)
}

export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let cart = await retrieveCart(undefined, "id,region_id")

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers,
    )
    cart = cartResp.cart

    await setCartId(cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function resetCartShippingMethods(cartId?: string) {
  const id = cartId || (await getCartId())
  if (!id) return null

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/carts/${id}/shipping-methods/reset`,
      {
        method: "POST",
        headers,
        cache: "no-store",
      }
    )
    .then(async ({ cart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
      return cart
    })
    .catch(() => null)
}

/**
 * Ensures the cart has the customer's default shipping address and pre-calculates the shipping quote.
 */
export async function syncCartWithDefaultAddressAndShipping(
  cart: HttpTypes.StoreCart | null,
  customer?: HttpTypes.StoreCustomer | null
): Promise<HttpTypes.StoreCart | null> {
  if (!cart?.id || !cart?.items?.length) {
    return cart
  }

  const cust =
    customer !== undefined
      ? customer
      : await retrieveCustomer().catch(() => null)
  if (!cust) {
    return cart
  }

  const defaultAddr =
    cust.addresses?.find((a) => a.is_default_shipping) || cust.addresses?.[0]

  if (!defaultAddr) {
    return cart
  }

  let currentCart = cart

  const hasValidAddress =
    currentCart.shipping_address &&
    isSameAddress(currentCart.shipping_address, defaultAddr)

  if (!hasValidAddress) {
    const updated = await updateCart({
      shipping_address: {
        first_name: defaultAddr.first_name || "",
        last_name: defaultAddr.last_name || "",
        address_1: defaultAddr.address_1 || "",
        address_2: defaultAddr.address_2 || "",
        company: defaultAddr.company || "",
        postal_code: defaultAddr.postal_code || "700000",
        city: defaultAddr.city || "",
        country_code: (defaultAddr.country_code || "vn").toLowerCase(),
        province: defaultAddr.province || "",
        phone: defaultAddr.phone || cust.phone || "",
        metadata: defaultAddr.metadata || undefined,
      },
      email: cust.email || currentCart.email,
    }).catch(() => null)

    if (updated) {
      currentCart = updated
    }
  }

  const shippingMethods = await listCartShippingMethods(currentCart.id)
  const defaultMethod =
    shippingMethods?.find((sm) => sm.price_type === "calculated") ||
    shippingMethods?.[0]

  if (defaultMethod) {
    const quote = await calculateShippingQuote(defaultMethod.id, currentCart.id)
    if (quote?.option?.amount != null) {
      const currentMethod = currentCart.shipping_methods?.find(
        (sm) => sm.shipping_option_id === defaultMethod.id
      )
      if (!currentMethod || currentMethod.amount !== quote.option.amount) {
        const updated = await setShippingMethod({
          cartId: currentCart.id,
          shippingMethodId: defaultMethod.id,
          data: {
            ghn_weight: quote.totalWeight,
            shipping_packages: quote.packages,
          },
        }).catch(() => null)
        if (updated) {
          currentCart = updated
        }
      }
    }
  }

  return currentCart
}

/**
 * Updates cart shipping address and immediately calculates/applies the GHN shipping method quote.
 */
export async function applyAddressAndRecalculateShipping(
  addressInput: Partial<HttpTypes.StoreCartAddress>,
  email?: string
): Promise<HttpTypes.StoreCart | null> {
  const cartId = await getCartId()
  if (!cartId) return null

  const shippingAddress: HttpTypes.StoreCreateCustomerAddress = {
    first_name: addressInput.first_name || "",
    last_name: addressInput.last_name || "",
    address_1: addressInput.address_1 || "",
    address_2: addressInput.address_2 || "",
    company: addressInput.company || "",
    postal_code: addressInput.postal_code || "700000",
    city: addressInput.city || "",
    country_code: (addressInput.country_code || "vn").toLowerCase(),
    province: addressInput.province || "",
    phone: addressInput.phone || "",
    metadata: addressInput.metadata || undefined,
  }

  let updatedCart = await updateCart({
    shipping_address: shippingAddress,
    billing_address: shippingAddress,
    ...(email ? { email } : {}),
  }).catch(() => null)

  if (!updatedCart) {
    updatedCart = await retrieveCart(cartId).catch(() => null)
  }

  if (!updatedCart) return null

  const shippingMethods = await listCartShippingMethods(updatedCart.id).catch(() => null)
  const defaultMethod =
    shippingMethods?.find((sm) => sm.price_type === "calculated") ||
    shippingMethods?.[0]

  if (defaultMethod) {
    const quote = await calculateShippingQuote(defaultMethod.id, updatedCart.id).catch(() => null)
    if (quote?.option?.amount != null) {
      const updatedWithShipping = await setShippingMethod({
        cartId: updatedCart.id,
        shippingMethodId: defaultMethod.id,
        data: {
          ghn_weight: quote.totalWeight,
          shipping_packages: quote.packages,
        },
      }).catch(() => null)
      if (updatedWithShipping) {
        updatedCart = updatedWithShipping
      }
    }
  }

  return updatedCart
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
}: {
  variantId: string
  quantity: number
  countryCode: string
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
      },
      {},
      headers,
    )
    .then(async () => {
      const customer = await retrieveCustomer().catch(() => null)
      const refreshedCart = await retrieveCart(cart.id)
      if (customer && refreshedCart) {
        await syncCartWithDefaultAddressAndShipping(refreshedCart, customer).catch(() => null)
      } else {
        await resetCartShippingMethods(cart.id).catch(() => null)
      }

      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      const customer = await retrieveCustomer().catch(() => null)
      const refreshedCart = await retrieveCart(cartId)
      if (customer && refreshedCart) {
        await syncCartWithDefaultAddressAndShipping(refreshedCart, customer).catch(() => null)
      } else {
        await resetCartShippingMethods(cartId).catch(() => null)
      }

      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const customer = await retrieveCustomer().catch(() => null)
      const refreshedCart = await retrieveCart(cartId)
      if (customer && refreshedCart && (refreshedCart.items?.length ?? 0) > 0) {
        await syncCartWithDefaultAddressAndShipping(refreshedCart, customer).catch(() => null)
      } else {
        await resetCartShippingMethods(cartId).catch(() => null)
      }

      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
  data,
}: {
  cartId: string
  shippingMethodId: string
  data?: Record<string, unknown>
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .addShippingMethod(
      cartId,
      { option_id: shippingMethodId, data },
      {},
      headers,
    )
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cart
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession,
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function applyGiftCard(_code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(_code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  _codeToRemove: string,
  _giftCards: unknown[],
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData,
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e)
  }
}

// TODO: Pass a POJO instead of a form entity here
export type SetAddressesState = {
  error?: string
  success?: boolean
}

export async function setAddresses(
  _currentState: SetAddressesState | null,
  formData: FormData,
): Promise<SetAddressesState> {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const phone = (formData.get("shipping_address.phone") as string)?.trim()
    if (!phone) {
      return { error: "Số điện thoại là bắt buộc để liên hệ giao hàng." }
    }

    const firstName = (formData.get("shipping_address.first_name") as string)?.trim()
    const lastName = (formData.get("shipping_address.last_name") as string)?.trim()
    const address1 = (formData.get("shipping_address.address_1") as string)?.trim()
    const countryCode = (
      (formData.get("shipping_address.country_code") as string)?.trim() || "vn"
    ).toLowerCase()
    const email = (formData.get("email") as string)?.trim()

    if (!firstName || !lastName) {
      return { error: "Vui lòng nhập đầy đủ họ và tên người nhận." }
    }
    if (!address1) {
      return { error: "Vui lòng nhập địa chỉ giao hàng." }
    }
    if (!email) {
      return { error: "Vui lòng nhập địa chỉ email." }
    }

    const province = (formData.get("shipping_address.province") as string)?.trim() || ""
    const city = (formData.get("shipping_address.city") as string)?.trim() || ""

    if (countryCode === "vn" && (!province || !city)) {
      return { error: "Vui lòng chọn Tỉnh/Thành phố và Quận/Huyện giao hàng." }
    }

    const ghnProvinceId = formData.get(
      "shipping_address.metadata.ghn_province_id",
    )
    const ghnDistrictId = formData.get(
      "shipping_address.metadata.ghn_district_id",
    )
    const ghnWardCode = formData.get("shipping_address.metadata.ghn_ward_code")

    const metadata: Record<string, unknown> = {}
    if (ghnProvinceId) metadata.ghn_province_id = Number(ghnProvinceId)
    if (ghnDistrictId) metadata.ghn_district_id = Number(ghnDistrictId)
    if (ghnWardCode) metadata.ghn_ward_code = String(ghnWardCode)

    const shippingAddress: HttpTypes.StoreCreateCustomerAddress = {
      first_name: firstName,
      last_name: lastName,
      address_1: address1,
      address_2: "",
      company: (formData.get("shipping_address.company") as string)?.trim() || "",
      postal_code: (formData.get("shipping_address.postal_code") as string)?.trim() || "700000",
      city: city,
      country_code: countryCode,
      province: province,
      phone: phone,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }

    const data: HttpTypes.StoreUpdateCart = {
      shipping_address: shippingAddress,
      email: email,
    }

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on" || !sameAsBilling) {
      data.billing_address = data.shipping_address
    } else {
      const billingPhone =
        (formData.get("billing_address.phone") as string)?.trim() || phone

      data.billing_address = {
        first_name:
          (formData.get("billing_address.first_name") as string)?.trim() || firstName,
        last_name:
          (formData.get("billing_address.last_name") as string)?.trim() || lastName,
        address_1:
          (formData.get("billing_address.address_1") as string)?.trim() || address1,
        address_2: "",
        company:
          (formData.get("billing_address.company") as string)?.trim() || "",
        postal_code:
          (formData.get("billing_address.postal_code") as string)?.trim() || "700000",
        city:
          (formData.get("billing_address.city") as string)?.trim() || city,
        country_code:
          (formData.get("billing_address.country_code") as string)?.trim().toLowerCase() || countryCode,
        province:
          (formData.get("billing_address.province") as string)?.trim() || province,
        phone: billingPhone,
      }
    }

    const currentCart = await retrieveCart(cartId)
    const previousAddress = currentCart?.shipping_address
    const addressChanged =
      !previousAddress ||
      !isSameAddress(previousAddress, shippingAddress)

    await updateCart(data)
    if (addressChanged) {
      await resetCartShippingMethods(cartId).catch(() => null)
    }

    const saveToCustomer = formData.get("save_to_customer")
    if (saveToCustomer === "on" || saveToCustomer === "true") {
      await saveCustomerShippingAddress(shippingAddress)
    }

    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}


/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag)

    await removeCartId()
    const locale = (await getLocale()) || "en"
    redirect(`/${locale}/${countryCode || "vn"}/order/${cartRes.order.id}/confirmed`)
  }

  return cartRes.cart
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag)

  const locale = (await getLocale()) || "en"
  redirect(`/${locale}/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}
