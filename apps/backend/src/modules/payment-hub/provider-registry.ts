export type PaymentProviderEnvironment = "sandbox" | "production"

export type ResolvedPaymentProvider = {
  code: string
  name: string
  providerId: string
  environment: PaymentProviderEnvironment
  isEnabled: boolean
  configuration: Record<string, unknown>
  secret: string
  checksum: string
  updatedAt?: string
}

const providers = new Map<string, ResolvedPaymentProvider>()

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

export const PaymentProviderRegistry = {
  clear() {
    providers.clear()
  },
  get(code: string) {
    return providers.get(normalizeCode(code))
  },
  set(provider: ResolvedPaymentProvider) {
    providers.set(normalizeCode(provider.code), {
      ...provider,
      code: normalizeCode(provider.code),
    })
  },
  list() {
    return Array.from(providers.values())
  },
  remove(code: string) {
    providers.delete(normalizeCode(code))
  },
}
