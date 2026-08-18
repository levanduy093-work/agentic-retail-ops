import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "dk"
const SUPPORTED_LOCALES = ["en", "vi"]
const DEFAULT_LOCALE = "en"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

const devAccessCache = {
  isPublic: false,
  lastChecked: 0,
}

async function checkDevAccessIsPublic(): Promise<boolean> {
  if (Date.now() - devAccessCache.lastChecked < 10000) {
    return devAccessCache.isPublic
  }

  try {
    if (!BACKEND_URL) return false
    const res = await fetch(`${BACKEND_URL}/store/dev-access/status`, {
      method: "GET",
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY || "",
      },
      next: { revalidate: 10 },
    })
    if (res.ok) {
      const data = await res.json()
      devAccessCache.isPublic = Boolean(data?.is_public)
      devAccessCache.lastChecked = Date.now()
      return devAccessCache.isPublic
    }
  } catch {
    // If backend unreachable or error, don't block
  }

  return devAccessCache.isPublic
}

async function hasValidDevAccessSession(token: string): Promise<boolean> {
  if (!BACKEND_URL || !token) return false
  try {
    const response = await fetch(`${BACKEND_URL}/store/dev-access/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": PUBLISHABLE_API_KEY || "" },
      body: JSON.stringify({ session_token: token }),
      cache: "no-store",
    })
    return response.ok && Boolean((await response.json()).valid)
  } catch {
    return false
  }
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable.",
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    const response = await fetch(`${BACKEND_URL}/store/regions`, {
      method: "GET",
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
      cache: "force-cache",
    })

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }

    const json = await response.json()

    const { regions } = json

    if (!regions?.length) {
      return new Map<string, HttpTypes.StoreRegion>()
    }

    // Create a map of country codes to regions.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        if (c?.iso_2) {
          regionMapCache.regionMap.set(c.iso_2.toLowerCase(), region)
        }
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

function serviceUnavailableResponse() {
  return new NextResponse(
    "The storefront cannot reach its Medusa backend. Verify the backend URL and that the local backend is healthy.",
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "5",
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  )
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>,
) {
  let countryCode

  const pathSegments = request.nextUrl.pathname.split("/").filter(Boolean)
  const firstSegment = pathSegments[0]?.toLowerCase()

  // Determine if the first segment is a locale
  const isFirstSegmentLocale = SUPPORTED_LOCALES.includes(firstSegment)

  // If first segment is locale, country code might be the second segment
  const urlCountryCode = isFirstSegmentLocale
    ? pathSegments[1]?.toLowerCase()
    : firstSegment

  // Cloudflare Workers provides country via request.cf.country
  const cloudflareCountryCode = (
    request as { cf?: { country?: string } }
  ).cf?.country?.toLowerCase()

  // Vercel provides x-vercel-ip-country header
  const vercelCountryCode = request.headers
    .get("x-vercel-ip-country")
    ?.toLowerCase()

  if (urlCountryCode && regionMap.has(urlCountryCode)) {
    countryCode = urlCountryCode
  } else if (cloudflareCountryCode && regionMap.has(cloudflareCountryCode)) {
    countryCode = cloudflareCountryCode
  } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
    countryCode = vercelCountryCode
  } else if (regionMap.has(DEFAULT_REGION)) {
    countryCode = DEFAULT_REGION
  } else if (regionMap.keys().next().value) {
    countryCode = regionMap.keys().next().value
  }

  return countryCode
}

function getLocale(request: NextRequest): string {
  const pathSegments = request.nextUrl.pathname.split("/").filter(Boolean)
  const firstSegment = pathSegments[0]?.toLowerCase()

  if (firstSegment && SUPPORTED_LOCALES.includes(firstSegment)) {
    return firstSegment
  }

  // Fallback to cookie
  const localeCookie = request.cookies.get("_medusa_locale")?.value
  if (localeCookie && SUPPORTED_LOCALES.includes(localeCookie)) {
    return localeCookie
  }

  return DEFAULT_LOCALE
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let consumeDevAccessSession = false
  if (pathname.includes(".") || pathname.includes("/dev-lock")) {
    return NextResponse.next()
  }

  const host = request.headers.get("host") || ""
  const isLocal =
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.endsWith(".local")

  if (!isLocal) {
    const isPublic = await checkDevAccessIsPublic()
    if (!isPublic) {
      const hasSession = await hasValidDevAccessSession(
        request.cookies.get("synapse_dev_access_session")?.value || ""
      )
      if (!hasSession) {
        const locale = getLocale(request)
        const country = DEFAULT_REGION
        const redirectUrl = `${request.nextUrl.origin}/${locale}/${country}/dev-lock?from=${encodeURIComponent(
          pathname + (request.nextUrl.search || ""),
        )}`
        return NextResponse.redirect(redirectUrl, 307)
      }
      consumeDevAccessSession = true
    }
  }

  const cacheIdCookie = request.cookies.get("_medusa_cache_id")
  const cacheId = cacheIdCookie?.value || crypto.randomUUID()

  let regionMap: Map<string, HttpTypes.StoreRegion>
  try {
    regionMap = await getRegionMap(cacheId)
  } catch (error) {
    console.error(
      "Unable to load Medusa regions in storefront middleware",
      error,
    )
    return serviceUnavailableResponse()
  }
  const countryCode = await getCountryCode(request, regionMap)
  const locale = getLocale(request)

  // if the country code is available, use it, otherwise use the default region
  const country = countryCode || DEFAULT_REGION

  const pathSegments = request.nextUrl.pathname.split("/").filter(Boolean)
  const urlHasLocale = pathSegments[0]?.toLowerCase() === locale
  const urlHasCountry = urlHasLocale
    ? pathSegments[1]?.toLowerCase() === country.toLowerCase()
    : pathSegments[0]?.toLowerCase() === country.toLowerCase()

  if (urlHasLocale && urlHasCountry) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-storefront-locale", locale)

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    if (!cacheIdCookie) {
      response.cookies.set("_medusa_cache_id", cacheId, {
        maxAge: 60 * 60 * 24,
      })
    }

    if (request.cookies.get("_medusa_locale")?.value !== locale) {
      response.cookies.set("_medusa_locale", locale, {
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "strict",
        secure: request.nextUrl.protocol === "https:",
      })
    }

    if (consumeDevAccessSession) {
      response.cookies.delete("synapse_dev_access_session")
    }

    return response
  }

  // if the url doesn't have the locale or country, redirect to it
  let redirectPath = request.nextUrl.pathname

  // Strip existing locale/country if they are incorrect
  if (pathSegments.length > 0) {
    if (SUPPORTED_LOCALES.includes(pathSegments[0].toLowerCase())) {
      pathSegments.shift()
    }
  }
  // Now check if the next segment is a valid country, if so strip it
  if (pathSegments.length > 0 && regionMap.has(pathSegments[0].toLowerCase())) {
    pathSegments.shift()
  }

  redirectPath = `/${pathSegments.join("/")}`

  const queryString = request.nextUrl.search || ""
  const redirectUrl = `${request.nextUrl.origin}/${locale}/${country}${redirectPath === "/" ? "" : redirectPath}${queryString}`

  const response = NextResponse.redirect(redirectUrl, 307)
  response.cookies.set("_medusa_locale", locale, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
  })

  if (!cacheIdCookie) {
    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
