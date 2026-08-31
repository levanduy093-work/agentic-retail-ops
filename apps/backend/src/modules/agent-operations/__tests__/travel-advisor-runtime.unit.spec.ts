import type { CustomerCatalogSnapshot } from "../customer-product-advisor"
import {
  buildTravelPackingChecklist,
  composeTravelOutfit,
  filterCatalogByTravelAttributes,
  formatTravelAdvisorEvidence,
  getTravelClimateNormals,
  getTravelWeatherForecast,
  resolveTravelLocation,
} from "../travel-advisor-runtime"

const location = {
  admin_area: "Tokyo",
  country: "Japan",
  country_code: "JP",
  latitude: 35.68,
  longitude: 139.76,
  name: "Tokyo",
  timezone: "Asia/Tokyo",
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  })
}

function product(id: string, title: string, variantTitle: string, price: number, availability = "IN_STOCK") {
  return {
    category_names: [],
    collection_title: null,
    description: `${title} phù hợp đi du lịch`,
    handle: id,
    id,
    product_url: `https://shop.example.com/vn/products/${id}`,
    subtitle: null,
    thumbnail: null,
    title,
    variants: [{
      availability,
      available_quantity: availability === "IN_STOCK" ? 5 : 0,
      currency_code: "vnd",
      id: `${id}_variant`,
      manage_inventory: true,
      price,
      sku: null,
      title: variantTitle,
    }],
  }
}

describe("travel advisor runtime", () => {
  it("resolves bounded provider-backed location candidates", async () => {
    const output = await resolveTravelLocation(
      { locale: "vi", query: "Tokyo" },
      jest.fn(async () => response({ results: [{ ...location, admin1: "Tokyo" }] }))
    )

    expect(output).toMatchObject({
      ambiguous: false,
      source: "OPEN_METEO_GEOCODING",
      status: "FOUND",
    })
    expect(output.candidates[0]).toMatchObject({ name: "Tokyo", timezone: "Asia/Tokyo" })
  })

  it("labels dated provider output as forecast and rejects use beyond its horizon", async () => {
    const fetcher = jest.fn(async () => response({ daily: {
      apparent_temperature_max: [31],
      apparent_temperature_min: [24],
      precipitation_probability_max: [60],
      temperature_2m_max: [30],
      temperature_2m_min: [23],
      time: ["2026-08-25"],
      uv_index_max: [7],
      weather_code: [61],
      wind_speed_10m_max: [18],
    } }))
    const forecast = await getTravelWeatherForecast(
      { end_date: "2026-08-25", location, start_date: "2026-08-25" },
      fetcher,
      new Date("2026-08-23T00:00:00.000Z")
    )
    expect(forecast).toMatchObject({ evidence_kind: "FORECAST", status: "READY" })
    expect(forecast.weather_days[0]).toMatchObject({ precipitation_probability_max_percent: 60 })

    const outOfRange = await getTravelWeatherForecast(
      { end_date: "2026-10-01", location, start_date: "2026-10-01" },
      fetcher,
      new Date("2026-08-23T00:00:00.000Z")
    )
    expect(outOfRange).toMatchObject({ evidence_kind: "FORECAST", status: "OUT_OF_RANGE" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("hard-filters size, budget and live availability before composing an outfit", () => {
    const catalog = {
      products: [
        product("prod_top", "Áo khoác du lịch", "Size M", 700_000),
        product("prod_bottom", "Quần jeans", "Size M", 550_000),
        product("prod_expensive", "Áo blazer", "Size M", 2_000_000),
        product("prod_oos", "Áo polo", "Size M", 400_000, "OUT_OF_STOCK"),
      ],
      query: "đồ du lịch",
      status: "READY",
      total_count: 4,
    } as CustomerCatalogSnapshot
    const filtered = filterCatalogByTravelAttributes(catalog, {
      max_budget: 1_000_000,
      query: "đồ du lịch",
      size: "M",
    })
    expect(filtered.status === "READY" && filtered.products.map((item) => item.id)).toEqual([
      "prod_top",
      "prod_bottom",
    ])
    expect(composeTravelOutfit(filtered, { max_items: 3 })).toMatchObject({
      product_ids: ["prod_top", "prod_bottom"],
      status: "READY",
    })
  })

  it("labels multi-year archive aggregates as historical climate, never forecast", async () => {
    const climate = await getTravelClimateNormals(
      { end_date: "2026-12-03", location, start_date: "2026-12-01" },
      jest.fn(async () => response({ daily: {
        precipitation_sum: [0, 2, 0],
        temperature_2m_max: [20, 21, 19],
        temperature_2m_min: [10, 11, 9],
        wind_speed_10m_max: [12, 14, 10],
      } })),
      new Date("2026-08-23T00:00:00.000Z")
    )

    expect(climate).toMatchObject({
      evidence_kind: "HISTORICAL_CLIMATE",
      sample_years: [2025, 2024, 2023],
      source: "OPEN_METEO_ARCHIVE",
      temperature_max_avg_c: 20,
      temperature_min_avg_c: 10,
    })
    expect(formatTravelAdvisorEvidence({ climate }, "vi")).toContain("Đây không phải dự báo")
  })

  it("keeps generic necessities out of store recommendations", () => {
    const catalog = {
      products: [product("prod_top", "Áo khoác du lịch", "Size M", 700_000)],
      query: "đồ du lịch",
      status: "READY",
      total_count: 1,
    } as CustomerCatalogSnapshot
    const checklist = buildTravelPackingChecklist({
      catalog,
      forecast: {
        evidence_kind: "FORECAST",
        fetched_at: "2026-08-23T00:00:00.000Z",
        location,
        source: "OPEN_METEO_FORECAST",
        status: "READY",
        weather_days: [{
          apparent_temperature_max_c: 30,
          apparent_temperature_min_c: 16,
          date: "2026-08-25",
          precipitation_probability_max_percent: 70,
          temperature_max_c: 30,
          temperature_min_c: 17,
          uv_index_max: 8,
          weather_code: 61,
          wind_speed_max_kmh: 20,
        }],
      },
      outfit: { missing_roles: [], product_ids: ["prod_top"], reasons: [], status: "READY" },
      trip_days: 3,
    })
    expect(checklist.buy_from_store).toEqual([
      expect.objectContaining({ product_id: "prod_top" }),
    ])
    expect(checklist.bring_from_home).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: "Ô gấp hoặc áo mưa mỏng", product_id: null }),
      expect.objectContaining({ item: "Một lớp giữ ấm dự phòng", product_id: null }),
    ]))
    expect(formatTravelAdvisorEvidence({ forecast: {
      evidence_kind: "FORECAST",
      fetched_at: "2026-08-23T00:00:00.000Z",
      location,
      source: "OPEN_METEO_FORECAST",
      status: "READY",
      weather_days: [{
        apparent_temperature_max_c: 30,
        apparent_temperature_min_c: 16,
        date: "2026-08-25",
        precipitation_probability_max_percent: 70,
        temperature_max_c: 30,
        temperature_min_c: 17,
        uv_index_max: 8,
        weather_code: 61,
        wind_speed_max_kmh: 20,
      }],
    } }, "vi")).toContain("Dự báo tại Tokyo")
  })
})
