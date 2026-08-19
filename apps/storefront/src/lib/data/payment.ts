"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export type PayosPaymentStatusResponse = {
  success: boolean
  orderCode?: number
  status?: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED"
  is_paid?: boolean
  amount?: number
  amount_paid?: number
  amount_remaining?: number
  message?: string
}

export const listCartPaymentMethods = async (regionId: string) => {
  if (!regionId) {
    return []
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("payment_providers")),
  }

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next: { ...next, revalidate: 0 },
        cache: "no-store",
      }
    )
    .then(({ payment_providers }) =>
      (payment_providers || []).sort((a, b) => {
        return a.id > b.id ? 1 : -1
      })
    )
    .catch((err) => {
      console.error("[listCartPaymentMethods] Error fetching payment providers:", err)
      return []
    })
}

export const checkPayosPaymentStatus = async (
  orderCode: number | string
): Promise<PayosPaymentStatusResponse | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<PayosPaymentStatusResponse>(
      `/store/payos/check-payment/${orderCode}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    )
    .then((res) => res)
    .catch(() => null)
}

export type PayosPaymentData = {
  orderCode: number
  amount: number
  description: string
  bin: string
  accountNumber: string
  accountName: string
  checkoutUrl?: string
  qrCode?: string
  paymentLinkId?: string
  expiredAt?: number
  status?: string
}

export const refreshPayosPayment = async (
  orderId: string
): Promise<{ success: boolean; data?: PayosPaymentData; message?: string }> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{ success: boolean; data?: PayosPaymentData; message?: string }>(
      `/store/payos/refresh-payment/${orderId}`,
      {
        method: "POST",
        headers,
        cache: "no-store",
      }
    )
    .then((res) => res)
    .catch((err) => ({
      success: false,
      message: err.message || "Failed to refresh payment",
    }))
}

