type StorefrontUrlEnvironment = {
  CUSTOMER_STOREFRONT_BASE_URL?: string
  NODE_ENV?: string
  STORE_CORS?: string
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

function parseOrigin(value: string) {
  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export function resolveTrustedStorefrontOrigin(
  environment: StorefrontUrlEnvironment
) {
  const configured = environment.CUSTOMER_STOREFRONT_BASE_URL?.trim()
  const candidate =
    configured ||
    (environment.NODE_ENV === "production" ? "" : "http://localhost:8000")
  if (!candidate) return null

  const candidateOrigin = parseOrigin(candidate)
  if (!candidateOrigin) return null
  const allowedOrigins = new Set(
    (environment.STORE_CORS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value && value !== "*")
      .flatMap((value) => {
        const origin = parseOrigin(value)
        return origin ? [origin] : []
      })
  )
  return allowedOrigins.has(candidateOrigin) ? candidateOrigin : null
}

export function buildTrustedProductUrl(input: {
  country_code: string
  environment: StorefrontUrlEnvironment
  handle: string
  locale: "en" | "vi"
}) {
  const origin = resolveTrustedStorefrontOrigin(input.environment)
  if (!origin) return null
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._~-]{0,200}$/u.test(input.handle)) {
    return null
  }
  if (!/^[a-z]{2}$/u.test(input.country_code.toLocaleLowerCase())) {
    return null
  }
  const safeSegments = [
    input.locale,
    input.country_code.toLocaleLowerCase(),
    "products",
    input.handle,
  ].map((segment) => encodeURIComponent(segment))
  return new URL(`/${safeSegments.join("/")}`, origin).toString()
}
