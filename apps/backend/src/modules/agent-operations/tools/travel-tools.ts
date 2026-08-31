import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"
import { CatalogReadOutput } from "./catalog-tools"

export const TravelLocationResolveInput = z.strictObject({
  country_code: z.string().trim().length(2).optional(),
  locale: z.enum(["en", "vi"]).default("vi"),
  query: z.string().trim().min(2).max(160),
})

export const TravelLocation = z.strictObject({
  admin_area: z.string().nullable(),
  country: z.string(),
  country_code: z.string().length(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().min(1),
  timezone: z.string().min(1),
})

export const TravelLocationResolveOutput = z.strictObject({
  ambiguous: z.boolean(),
  candidates: z.array(TravelLocation).max(5),
  query: z.string(),
  source: z.literal("OPEN_METEO_GEOCODING"),
  status: z.enum(["FOUND", "NOT_FOUND"]),
})

export const WeatherForecastInput = z.strictObject({
  end_date: z.string().date(),
  start_date: z.string().date(),
})

export const WeatherDay = z.strictObject({
  apparent_temperature_max_c: z.number().nullable(),
  apparent_temperature_min_c: z.number().nullable(),
  date: z.string().date(),
  precipitation_probability_max_percent: z.number().nullable(),
  temperature_max_c: z.number().nullable(),
  temperature_min_c: z.number().nullable(),
  uv_index_max: z.number().nullable(),
  weather_code: z.number().int().nullable(),
  wind_speed_max_kmh: z.number().nullable(),
})

export const WeatherForecastOutput = z.strictObject({
  evidence_kind: z.literal("FORECAST"),
  fetched_at: z.string().datetime(),
  location: TravelLocation,
  source: z.literal("OPEN_METEO_FORECAST"),
  status: z.enum(["READY", "OUT_OF_RANGE"]),
  weather_days: z.array(WeatherDay).max(16),
})

export const WeatherClimateInput = z.strictObject({
  end_date: z.string().date(),
  start_date: z.string().date(),
})

export const WeatherClimateOutput = z.strictObject({
  evidence_kind: z.literal("HISTORICAL_CLIMATE"),
  location: TravelLocation,
  precipitation_days_ratio: z.number().min(0).max(1).nullable(),
  sample_years: z.array(z.number().int()).min(1),
  source: z.literal("OPEN_METEO_ARCHIVE"),
  temperature_max_avg_c: z.number().nullable(),
  temperature_min_avg_c: z.number().nullable(),
  wind_speed_max_avg_kmh: z.number().nullable(),
})

export const CatalogAttributeSearchInput = z.strictObject({
  activity: z.string().trim().min(1).max(120).optional(),
  max_budget: z.number().positive().optional(),
  query: z.string().trim().min(1).max(160),
  size: z.string().trim().min(1).max(30).optional(),
  style: z.string().trim().min(1).max(80).optional(),
  weather_needs: z.array(z.enum([
    "BREATHABLE",
    "RAIN_PROTECTION",
    "SUN_PROTECTION",
    "WARM_LAYER",
    "WIND_PROTECTION",
  ])).max(5).default([]),
})

export const OutfitComposeInput = z.strictObject({
  activity: z.string().trim().min(1).max(120).optional(),
  max_items: z.number().int().min(1).max(5).default(3),
  style: z.string().trim().min(1).max(80).optional(),
})

export const OutfitComposeOutput = z.strictObject({
  missing_roles: z.array(z.string()),
  product_ids: z.array(z.string()).max(5),
  reasons: z.array(z.string()).max(5),
  status: z.enum(["READY", "PARTIAL", "NO_MATCH"]),
})

export const TravelPackingChecklistInput = z.strictObject({
  activity: z.string().trim().min(1).max(120).optional(),
  trip_days: z.number().int().min(1).max(60).default(3),
})

export const PackingChecklistItem = z.strictObject({
  item: z.string().min(1),
  product_id: z.string().nullable(),
  reason: z.string().min(1),
})

export const TravelPackingChecklistOutput = z.strictObject({
  bring_from_home: z.array(PackingChecklistItem).max(12),
  buy_from_store: z.array(PackingChecklistItem).max(5),
  evidence_kind: z.enum(["FORECAST", "HISTORICAL_CLIMATE", "GENERAL"]),
  optional: z.array(PackingChecklistItem).max(8),
})

export type TravelLocation = z.infer<typeof TravelLocation>
export type TravelLocationResolveInput = z.infer<typeof TravelLocationResolveInput>
export type TravelLocationResolveOutput = z.infer<typeof TravelLocationResolveOutput>
export type WeatherForecastInput = z.infer<typeof WeatherForecastInput>
export type WeatherForecastOutput = z.infer<typeof WeatherForecastOutput>
export type WeatherClimateInput = z.infer<typeof WeatherClimateInput>
export type WeatherClimateOutput = z.infer<typeof WeatherClimateOutput>
export type CatalogAttributeSearchInput = z.infer<typeof CatalogAttributeSearchInput>
export type OutfitComposeInput = z.infer<typeof OutfitComposeInput>
export type OutfitComposeOutput = z.infer<typeof OutfitComposeOutput>
export type TravelPackingChecklistInput = z.infer<typeof TravelPackingChecklistInput>
export type TravelPackingChecklistOutput = z.infer<typeof TravelPackingChecklistOutput>

function readTool<TInput, TOutput, const TName extends string>(definition: {
  description: string
  input_schema: { parse(value: unknown): TInput }
  name: TName
  output_schema: { parse(value: unknown): TOutput }
  permission?: string
  timeout_ms?: number
}) {
  return defineAgentTool({
    approval_required: false,
    audit_fields: ["source", "evidence_kind", "location", "product_ids"],
    description: definition.description,
    error_codes: ["TRAVEL_READ_FAILED", "INVALID_TOOL_INPUT"],
    idempotency: "NOT_REQUIRED",
    input_schema: definition.input_schema,
    kind: "READ",
    name: definition.name,
    output_schema: definition.output_schema,
    permission: definition.permission ?? "agent_travel:read",
    required_role: null,
    retry: { backoff: "EXPONENTIAL", base_delay_ms: 250, max_attempts: 2, max_delay_ms: 1_000 },
    risk_level: "READ_ONLY",
    timeout_ms: definition.timeout_ms ?? 8_000,
    version: "1.0.0",
  })
}

export const TRAVEL_LOCATION_RESOLVE_TOOL = readTool({
  description: "Resolve a customer-stated travel destination to bounded geographic candidates.",
  input_schema: TravelLocationResolveInput,
  name: "travel.resolve-location",
  output_schema: TravelLocationResolveOutput,
})

export const WEATHER_FORECAST_TOOL = readTool({
  description: "Read dated weather forecast evidence for a resolved destination.",
  input_schema: WeatherForecastInput,
  name: "weather.get-forecast",
  output_schema: WeatherForecastOutput,
})

export const WEATHER_CLIMATE_TOOL = readTool({
  description: "Read multi-year historical climate evidence for dates outside the forecast horizon.",
  input_schema: WeatherClimateInput,
  name: "weather.get-climate-normals",
  output_schema: WeatherClimateOutput,
  timeout_ms: 12_000,
})

export const CATALOG_ATTRIBUTE_SEARCH_TOOL = readTool({
  description: "Filter the live catalog by customer needs, size, budget, activity, and weather needs.",
  input_schema: CatalogAttributeSearchInput,
  name: "catalog.search-by-attributes",
  output_schema: CatalogReadOutput,
  permission: "agent_catalog:read",
})

export const OUTFIT_COMPOSE_TOOL = readTool({
  description: "Compose a bounded outfit only from live catalog products returned in this turn.",
  input_schema: OutfitComposeInput,
  name: "outfit.compose",
  output_schema: OutfitComposeOutput,
  permission: "agent_catalog:read",
})

export const TRAVEL_PACKING_CHECKLIST_TOOL = readTool({
  description: "Build a packing checklist that separates bring-from-home items from store products.",
  input_schema: TravelPackingChecklistInput,
  name: "travel.build-packing-checklist",
  output_schema: TravelPackingChecklistOutput,
})
