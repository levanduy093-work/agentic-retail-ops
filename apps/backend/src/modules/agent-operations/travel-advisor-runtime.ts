import { MedusaError } from "@medusajs/framework/utils"
import type { CustomerCatalogSnapshot } from "./customer-product-advisor"
import type { NativeTravelAdvisorContext } from "./native-customer-support-context"
import type { CatalogProductResult } from "./tools/catalog-tools"
import {
  OutfitComposeOutput,
  TravelLocation,
  TravelLocationResolveOutput,
  TravelPackingChecklistOutput,
  WeatherClimateOutput,
  WeatherForecastOutput,
} from "./tools/travel-tools"

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

const FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast"
const GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com/v1/search"
const ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1/archive"

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function arrayValue(value: unknown, index: number) {
  return Array.isArray(value) ? value[index] : null
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime())) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Invalid travel date ${value}.`)
  }
  return date
}

function dateDiffDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000)
}

async function fetchJson(fetcher: FetchLike, url: URL) {
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Travel data provider returned HTTP ${response.status}.`
    )
  }
  return response.json() as Promise<Record<string, unknown>>
}

export async function resolveTravelLocation(
  input: { country_code?: string; locale: "en" | "vi"; query: string },
  fetcher: FetchLike = fetch
): Promise<TravelLocationResolveOutput> {
  const url = new URL(process.env.OPEN_METEO_GEOCODING_BASE_URL ?? GEOCODING_BASE_URL)
  url.searchParams.set("name", input.query)
  url.searchParams.set("count", "5")
  url.searchParams.set("language", input.locale)
  url.searchParams.set("format", "json")
  if (input.country_code) url.searchParams.set("countryCode", input.country_code.toUpperCase())
  const json = await fetchJson(fetcher, url)
  const candidates = (Array.isArray(json.results) ? json.results : []).flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const value = item as Record<string, unknown>
    if (
      typeof value.name !== "string" ||
      typeof value.country !== "string" ||
      typeof value.country_code !== "string" ||
      typeof value.latitude !== "number" ||
      typeof value.longitude !== "number" ||
      typeof value.timezone !== "string"
    ) return []
    return [{
      admin_area: typeof value.admin1 === "string" ? value.admin1 : null,
      country: value.country,
      country_code: value.country_code.toUpperCase(),
      latitude: value.latitude,
      longitude: value.longitude,
      name: value.name,
      timezone: value.timezone,
    }]
  }).slice(0, 5)
  return TravelLocationResolveOutput.parse({
    ambiguous: candidates.length > 1,
    candidates,
    query: input.query,
    source: "OPEN_METEO_GEOCODING",
    status: candidates.length ? "FOUND" : "NOT_FOUND",
  })
}

export async function getTravelWeatherForecast(
  input: { end_date: string; location: TravelLocation; start_date: string },
  fetcher: FetchLike = fetch,
  now = new Date()
): Promise<WeatherForecastOutput> {
  const start = parseDate(input.start_date)
  const end = parseDate(input.end_date)
  if (end < start || dateDiffDays(start, end) > 15) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Forecast range must be 1 to 16 days.")
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const outsideForecastWindow = start < today || dateDiffDays(today, end) > 15
  if (outsideForecastWindow) {
    return WeatherForecastOutput.parse({
      evidence_kind: "FORECAST",
      fetched_at: now.toISOString(),
      location: input.location,
      source: "OPEN_METEO_FORECAST",
      status: "OUT_OF_RANGE",
      weather_days: [],
    })
  }
  const url = new URL(process.env.OPEN_METEO_FORECAST_BASE_URL ?? FORECAST_BASE_URL)
  url.searchParams.set("latitude", String(input.location.latitude))
  url.searchParams.set("longitude", String(input.location.longitude))
  url.searchParams.set("start_date", input.start_date)
  url.searchParams.set("end_date", input.end_date)
  url.searchParams.set("timezone", input.location.timezone)
  url.searchParams.set("daily", [
    "temperature_2m_min", "temperature_2m_max",
    "apparent_temperature_min", "apparent_temperature_max",
    "precipitation_probability_max", "weather_code", "wind_speed_10m_max", "uv_index_max",
  ].join(","))
  const json = await fetchJson(fetcher, url)
  const daily = json.daily && typeof json.daily === "object"
    ? json.daily as Record<string, unknown>
    : {}
  const dates = Array.isArray(daily.time) ? daily.time : []
  const weatherDays = dates.flatMap((date, index) => typeof date === "string" ? [{
    apparent_temperature_max_c: numberOrNull(arrayValue(daily.apparent_temperature_max, index)),
    apparent_temperature_min_c: numberOrNull(arrayValue(daily.apparent_temperature_min, index)),
    date,
    precipitation_probability_max_percent: numberOrNull(arrayValue(daily.precipitation_probability_max, index)),
    temperature_max_c: numberOrNull(arrayValue(daily.temperature_2m_max, index)),
    temperature_min_c: numberOrNull(arrayValue(daily.temperature_2m_min, index)),
    uv_index_max: numberOrNull(arrayValue(daily.uv_index_max, index)),
    weather_code: numberOrNull(arrayValue(daily.weather_code, index)),
    wind_speed_max_kmh: numberOrNull(arrayValue(daily.wind_speed_10m_max, index)),
  }] : [])
  return WeatherForecastOutput.parse({
    evidence_kind: "FORECAST",
    fetched_at: now.toISOString(),
    location: input.location,
    source: "OPEN_METEO_FORECAST",
    status: "READY",
    weather_days: weatherDays,
  })
}

function replaceYear(date: Date, year: number) {
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const candidate = new Date(Date.UTC(year, month, day))
  if (candidate.getUTCMonth() !== month) candidate.setUTCDate(0)
  return candidate.toISOString().slice(0, 10)
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null)
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10 : null
}

export async function getTravelClimateNormals(
  input: { end_date: string; location: TravelLocation; start_date: string },
  fetcher: FetchLike = fetch,
  now = new Date()
): Promise<WeatherClimateOutput> {
  const start = parseDate(input.start_date)
  const end = parseDate(input.end_date)
  if (end < start || dateDiffDays(start, end) > 30) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Climate sample range must be 1 to 31 days.")
  }
  const years = [now.getUTCFullYear() - 1, now.getUTCFullYear() - 2, now.getUTCFullYear() - 3]
  const samples = await Promise.all(years.map(async (year) => {
    const url = new URL(process.env.OPEN_METEO_ARCHIVE_BASE_URL ?? ARCHIVE_BASE_URL)
    url.searchParams.set("latitude", String(input.location.latitude))
    url.searchParams.set("longitude", String(input.location.longitude))
    url.searchParams.set("start_date", replaceYear(start, year))
    url.searchParams.set("end_date", replaceYear(end, year))
    url.searchParams.set("timezone", input.location.timezone)
    url.searchParams.set("daily", "temperature_2m_min,temperature_2m_max,precipitation_sum,wind_speed_10m_max")
    return fetchJson(fetcher, url)
  }))
  const minValues: Array<number | null> = []
  const maxValues: Array<number | null> = []
  const windValues: Array<number | null> = []
  const precipitationFlags: boolean[] = []
  for (const sample of samples) {
    const daily = sample.daily && typeof sample.daily === "object"
      ? sample.daily as Record<string, unknown>
      : {}
    for (const value of Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : []) minValues.push(numberOrNull(value))
    for (const value of Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : []) maxValues.push(numberOrNull(value))
    for (const value of Array.isArray(daily.wind_speed_10m_max) ? daily.wind_speed_10m_max : []) windValues.push(numberOrNull(value))
    for (const value of Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : []) {
      const amount = numberOrNull(value)
      if (amount !== null) precipitationFlags.push(amount > 0.1)
    }
  }
  return WeatherClimateOutput.parse({
    evidence_kind: "HISTORICAL_CLIMATE",
    location: input.location,
    precipitation_days_ratio: precipitationFlags.length
      ? Math.round((precipitationFlags.filter(Boolean).length / precipitationFlags.length) * 100) / 100
      : null,
    sample_years: years,
    source: "OPEN_METEO_ARCHIVE",
    temperature_max_avg_c: average(maxValues),
    temperature_min_avg_c: average(minValues),
    wind_speed_max_avg_kmh: average(windValues),
  })
}

function normalizedProductText(product: CatalogProductResult) {
  return [product.title, product.subtitle, product.description, product.collection_title, ...product.category_names]
    .filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase()
}

function availableVariant(product: CatalogProductResult, size?: string, maxBudget?: number) {
  return product.variants.find((variant) => {
    const inStock = variant.availability === "IN_STOCK" || variant.availability === "NOT_MANAGED"
    const sizeMatches = !size || variant.title.toLocaleLowerCase().includes(size.toLocaleLowerCase())
    const budgetMatches = !maxBudget || (variant.price !== null && variant.price <= maxBudget)
    return inStock && sizeMatches && budgetMatches
  })
}

export function filterCatalogByTravelAttributes(
  catalog: CustomerCatalogSnapshot,
  input: { activity?: string; max_budget?: number; query: string; size?: string; style?: string; weather_needs?: string[] }
): CustomerCatalogSnapshot {
  if (catalog.status !== "READY") return catalog
  const softTerms = [input.activity, input.style, input.query]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.normalize("NFKC").toLocaleLowerCase().split(/\s+/u))
    .filter((term) => term.length >= 3)
  const weatherTerms: Record<string, string[]> = {
    BREATHABLE: ["thoáng", "cotton", "linen", "nhẹ", "breathable"],
    RAIN_PROTECTION: ["chống nước", "nhanh khô", "water", "rain"],
    SUN_PROTECTION: ["chống nắng", "dài tay", "uv", "sun"],
    WARM_LAYER: ["giữ ấm", "khoác", "len", "nỉ", "jacket", "blazer"],
    WIND_PROTECTION: ["chống gió", "khoác", "wind", "jacket"],
  }
  const evidenceTerms = (input.weather_needs ?? []).flatMap((need) => weatherTerms[need] ?? [])
  const products = catalog.products
    .filter((product) => Boolean(availableVariant(product, input.size, input.max_budget)))
    .map((product) => {
      const text = normalizedProductText(product)
      return {
        product,
        score:
          softTerms.filter((term) => text.includes(term)).length +
          evidenceTerms.filter((term) => text.includes(term)).length * 2,
      }
    })
    .sort((left, right) => right.score - left.score)
    .map(({ product }) => product)
    .slice(0, 8)
  return { ...catalog, products, total_count: products.length }
}

export function composeTravelOutfit(
  catalog: CustomerCatalogSnapshot,
  input: { max_items: number }
): OutfitComposeOutput {
  if (catalog.status !== "READY") return { missing_roles: ["catalog"], product_ids: [], reasons: [], status: "NO_MATCH" }
  const roles = [
    { name: "top", pattern: /áo|shirt|polo|blazer|jacket|khoác/iu },
    { name: "bottom", pattern: /quần|jeans|short|skirt|váy/iu },
    { name: "outer_layer", pattern: /khoác|jacket|blazer|cardigan/iu },
  ]
  const selected: CatalogProductResult[] = []
  const missing: string[] = []
  for (const role of roles) {
    const product = catalog.products.find((candidate) =>
      !selected.some((item) => item.id === candidate.id) && role.pattern.test(normalizedProductText(candidate))
    )
    if (product && selected.length < input.max_items) selected.push(product)
    else if (role.name !== "outer_layer") missing.push(role.name)
  }
  return OutfitComposeOutput.parse({
    missing_roles: missing,
    product_ids: selected.map((product) => product.id),
    reasons: selected.map((product) => `${product.title}: còn biến thể có thể bán và phù hợp một vai trò trong set.`),
    status: !selected.length ? "NO_MATCH" : missing.length ? "PARTIAL" : "READY",
  })
}

export function buildTravelPackingChecklist(input: {
  catalog: CustomerCatalogSnapshot | undefined
  climate?: WeatherClimateOutput
  forecast?: WeatherForecastOutput
  outfit?: OutfitComposeOutput
  trip_days: number
}): TravelPackingChecklistOutput {
  const readyForecast = input.forecast?.status === "READY" ? input.forecast : undefined
  const rainExpected = readyForecast
    ? readyForecast.weather_days.some((day) => (day.precipitation_probability_max_percent ?? 0) >= 40)
    : (input.climate?.precipitation_days_ratio ?? 0) >= 0.35
  const coldExpected = readyForecast
    ? readyForecast.weather_days.some((day) => (day.apparent_temperature_min_c ?? 99) < 18)
    : (input.climate?.temperature_min_avg_c ?? 99) < 18
  const hotExpected = readyForecast
    ? readyForecast.weather_days.some((day) => (day.temperature_max_c ?? 0) >= 29)
    : (input.climate?.temperature_max_avg_c ?? 0) >= 29
  const bringFromHome = [
    { item: `${input.trip_days + 1} bộ đồ lót`, product_id: null, reason: "Đủ dùng cho chuyến đi và có một bộ dự phòng." },
    { item: "Giày đã đi quen chân", product_id: null, reason: "Giảm nguy cơ đau chân khi di chuyển nhiều." },
  ]
  if (rainExpected) bringFromHome.push({ item: "Ô gấp hoặc áo mưa mỏng", product_id: null, reason: "Có tín hiệu mưa từ dữ liệu thời tiết dùng cho chuyến đi." })
  if (hotExpected) bringFromHome.push({ item: "Kem chống nắng và mũ", product_id: null, reason: "Nhiệt độ có thể cao; đây không phải sản phẩm đã xác minh trong catalog." })
  if (coldExpected) bringFromHome.push({ item: "Một lớp giữ ấm dự phòng", product_id: null, reason: "Nhiệt độ cảm nhận thấp vào một phần thời gian của chuyến đi." })
  const products = input.catalog?.status === "READY" ? input.catalog.products : []
  const selectedIds = new Set(input.outfit?.product_ids ?? [])
  const buyFromStore = products.filter((product) => selectedIds.has(product.id)).slice(0, 5).map((product) => ({
    item: product.title,
    product_id: product.id,
    reason: "Sản phẩm thuộc set đã phối từ catalog sống và còn biến thể có thể bán.",
  }))
  return TravelPackingChecklistOutput.parse({
    bring_from_home: bringFromHome,
    buy_from_store: buyFromStore,
    evidence_kind: readyForecast ? "FORECAST" : input.climate ? "HISTORICAL_CLIMATE" : "GENERAL",
    optional: [{ item: "Túi vải gấp gọn", product_id: null, reason: "Tiện đựng đồ phát sinh trong chuyến đi." }],
  })
}

export function formatTravelAdvisorEvidence(
  context: NativeTravelAdvisorContext | undefined,
  locale: "en" | "vi"
) {
  if (!context) return ""
  const sections: string[] = []
  if (context.forecast?.status === "READY" && context.forecast.weather_days.length) {
    const lows = context.forecast.weather_days.flatMap((day) => day.temperature_min_c === null ? [] : [day.temperature_min_c])
    const highs = context.forecast.weather_days.flatMap((day) => day.temperature_max_c === null ? [] : [day.temperature_max_c])
    const rain = Math.max(...context.forecast.weather_days.map((day) => day.precipitation_probability_max_percent ?? 0))
    if (lows.length && highs.length) {
      sections.push(locale === "vi"
        ? `Dự báo tại ${context.forecast.location.name}: khoảng ${Math.min(...lows)}–${Math.max(...highs)}°C, xác suất mưa cao nhất ${rain}%.`
        : `Forecast for ${context.forecast.location.name}: about ${Math.min(...lows)}–${Math.max(...highs)}°C, with peak rain probability of ${rain}%.`)
    }
  } else if (context.climate) {
    sections.push(locale === "vi"
      ? `Tham khảo khí hậu lịch sử ${context.climate.sample_years.join(", ")} tại ${context.climate.location.name}: trung bình khoảng ${context.climate.temperature_min_avg_c ?? "?"}–${context.climate.temperature_max_avg_c ?? "?"}°C. Đây không phải dự báo cho ngày đi.`
      : `Historical climate reference (${context.climate.sample_years.join(", ")}) for ${context.climate.location.name}: roughly ${context.climate.temperature_min_avg_c ?? "?"}–${context.climate.temperature_max_avg_c ?? "?"}°C on average. This is not a trip-date forecast.`)
  }
  const packing = context.packing_checklist
  if (packing) {
    const bring = packing.bring_from_home.map((item) => item.item).join(", ")
    if (bring) sections.push(locale === "vi" ? `Nên mang theo: ${bring}.` : `Bring from home: ${bring}.`)
  }
  return sections.join("\n\n")
}
