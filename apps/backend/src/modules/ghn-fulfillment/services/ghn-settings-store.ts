import { existsSync, readFileSync } from "fs"
import { resolve } from "path"
import { GhnConfig, GhnEnvironment } from "../ghn-client"
import { ShippingCarrierRegistry } from "../../shipping-hub/carrier-registry"
import type { PackagingProfile } from "../../shipping-hub/packing-profile"

export type GhnFullSettings = {
  api_token: string
  shop_id: number
  client_id?: number
  environment: GhnEnvironment
  base_url?: string
  sender_name: string
  sender_phone: string
  sender_address: string
  sender_province_id?: number
  sender_district_id?: number
  sender_ward_code?: string
  default_weight: number
  default_length: number
  default_width: number
  default_height: number
  required_note: "KHONGCHOXEMHANG" | "CHOXEMHANGKHONGTHU" | "CHOTOT"
  payment_type_id: number // 1: Seller pays, 2: Buyer pays
  is_insured: boolean
  packing_profile?: PackagingProfile
  updated_at?: string
}

// Canonical file paths for multi-environment reliability
const BACKEND_SETTINGS_PATH = resolve(__dirname, "../../../..", ".ghn-settings.json")
const ROOT_SETTINGS_PATH = resolve(__dirname, "../../../../..", ".ghn-settings.json")
const CWD_SETTINGS_PATH = resolve(process.cwd(), ".ghn-settings.json")

const DEFAULT_SETTINGS: GhnFullSettings = {
  api_token: process.env.GHN_API_TOKEN || "",
  shop_id: Number(process.env.GHN_SHOP_ID || "0"),
  client_id: process.env.GHN_CLIENT_ID
    ? Number(process.env.GHN_CLIENT_ID)
    : undefined,
  environment:
    (process.env.GHN_ENVIRONMENT as GhnEnvironment) || "sandbox",
  base_url: process.env.GHN_API_URL || undefined,
  sender_name: process.env.GHN_SENDER_NAME || "Synapse Store",
  sender_phone: process.env.GHN_SENDER_PHONE || "0900000000",
  sender_address:
    process.env.GHN_SENDER_ADDRESS || "Số 1 Lê Duẩn, Bến Nghé, Quận 1",
  sender_province_id: process.env.GHN_SENDER_PROVINCE_ID
    ? Number(process.env.GHN_SENDER_PROVINCE_ID)
    : 202, // TP.HCM
  sender_district_id: process.env.GHN_SENDER_DISTRICT_ID
    ? Number(process.env.GHN_SENDER_DISTRICT_ID)
    : 1442, // Quận 1
  sender_ward_code: process.env.GHN_SENDER_WARD_CODE || "20101",
  default_weight: Number(process.env.GHN_DEFAULT_WEIGHT || "300"),
  default_length: Number(process.env.GHN_DEFAULT_LENGTH || "15"),
  default_width: Number(process.env.GHN_DEFAULT_WIDTH || "10"),
  default_height: Number(process.env.GHN_DEFAULT_HEIGHT || "10"),
  required_note: "KHONGCHOXEMHANG",
  payment_type_id: 1, // 1: Seller pays
  is_insured: true,
}

let cachedSettings: GhnFullSettings | null = null

export class GhnSettingsStore {
  /**
   * Reads the former local-file settings only for the one-time migration path.
   * Runtime reads always prefer the encrypted Shipping Hub connection registry.
   */
  public static getLegacySettings(): GhnFullSettings {
    if (cachedSettings) {
      return { ...cachedSettings }
    }

    const candidatePaths = [
      BACKEND_SETTINGS_PATH,
      CWD_SETTINGS_PATH,
      ROOT_SETTINGS_PATH,
    ]

    for (const filePath of candidatePaths) {
      try {
        if (existsSync(filePath)) {
          const data = readFileSync(filePath, "utf-8")
          const parsed = JSON.parse(data)
          if (parsed && typeof parsed === "object") {
            const merged: GhnFullSettings = {
              ...DEFAULT_SETTINGS,
              ...parsed,
              api_token: parsed.api_token || DEFAULT_SETTINGS.api_token || "",
              shop_id: Number(parsed.shop_id || DEFAULT_SETTINGS.shop_id || 0),
              environment: (parsed.environment || DEFAULT_SETTINGS.environment || "sandbox") as GhnEnvironment,
              sender_name: parsed.sender_name || DEFAULT_SETTINGS.sender_name,
              sender_phone: parsed.sender_phone || DEFAULT_SETTINGS.sender_phone,
              sender_address: parsed.sender_address || DEFAULT_SETTINGS.sender_address,
              default_weight: Number(parsed.default_weight || DEFAULT_SETTINGS.default_weight),
              default_length: Number(parsed.default_length || DEFAULT_SETTINGS.default_length),
              default_width: Number(parsed.default_width || DEFAULT_SETTINGS.default_width),
              default_height: Number(parsed.default_height || DEFAULT_SETTINGS.default_height),
              required_note: parsed.required_note || DEFAULT_SETTINGS.required_note,
              payment_type_id: Number(parsed.payment_type_id || DEFAULT_SETTINGS.payment_type_id),
              is_insured: Boolean(parsed.is_insured ?? DEFAULT_SETTINGS.is_insured),
            }
            cachedSettings = merged
            return { ...cachedSettings }
          }
        }
      } catch {
        // try next candidate
      }
    }

    cachedSettings = { ...DEFAULT_SETTINGS }
    return { ...cachedSettings }
  }

  public static getSettings(): GhnFullSettings {
    const carrier = ShippingCarrierRegistry.get("GHN")
    if (!carrier) {
      return this.getLegacySettings()
    }

    const configuration = carrier.configuration
    return {
      ...DEFAULT_SETTINGS,
      ...(configuration as Partial<GhnFullSettings>),
      api_token: carrier.secret,
      shop_id: Number(configuration.shop_id || 0),
      environment: carrier.environment,
      updated_at: carrier.updatedAt,
    }
  }

  public static setRuntimeSettings(settings: GhnFullSettings) {
    ShippingCarrierRegistry.set({
      code: "GHN",
      name: "Giao Hàng Nhanh",
      providerId: "ghn_ghn",
      environment: settings.environment,
      isEnabled: true,
      configuration: {
        ...settings,
        api_token: undefined,
      },
      secret: settings.api_token,
      updatedAt: settings.updated_at,
    })
  }

  public static getGhnConfig(): GhnConfig {
    const s = this.getSettings()
    return {
      apiToken: s.api_token,
      shopId: s.shop_id,
      clientId: s.client_id,
      environment: s.environment,
      baseUrl: s.base_url,
    }
  }
}
