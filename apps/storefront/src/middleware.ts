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

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable."
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
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
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
  const cloudflareCountryCode = (request as { cf?: { country?: string } }).cf?.country?.toLowerCase()

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
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const cacheIdCookie = request.cookies.get("_medusa_cache_id")
  const cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)
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
    if (!cacheIdCookie) {
      const response = NextResponse.next()
      response.cookies.set("_medusa_cache_id", cacheId, {
        maxAge: 60 * 60 * 24,
      })
      return response
    }
    return NextResponse.next()
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

  return NextResponse.redirect(redirectUrl, 307)
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
