export type ShippingCarrierEnvironment = "sandbox" | "production"

export type ResolvedShippingCarrier = {
  code: string
  name: string
  providerId: string
  environment: ShippingCarrierEnvironment
  isEnabled: boolean
  configuration: Record<string, unknown>
  secret: string
  updatedAt?: string
}

const carriers = new Map<string, ResolvedShippingCarrier>()

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

export const ShippingCarrierRegistry = {
  clear() {
    carriers.clear()
  },
  get(code: string) {
    return carriers.get(normalizeCode(code))
  },
  set(carrier: ResolvedShippingCarrier) {
    carriers.set(normalizeCode(carrier.code), {
      ...carrier,
      code: normalizeCode(carrier.code),
    })
  },
  list() {
    return Array.from(carriers.values())
  },
}
