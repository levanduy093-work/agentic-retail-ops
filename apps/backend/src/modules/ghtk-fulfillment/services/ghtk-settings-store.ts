import { GhtkEnvironment } from "../ghtk-client"
import type { PackagingProfile } from "../../shipping-hub/packing-profile"

export type GhtkFullSettings = {
  api_token: string
  environment: GhtkEnvironment
  base_url?: string
  sender_name: string
  sender_phone: string
  sender_address: string
  sender_province?: string
  sender_district?: string
  sender_ward?: string
  pick_address_id?: string
  default_weight: number
  default_length: number
  default_width: number
  default_height: number
  is_freeship: boolean
  transport: "road" | "fly"
  packing_profile?: PackagingProfile
  updated_at?: string
}

const DEFAULT_SETTINGS: GhtkFullSettings = {
  api_token: process.env.GHTK_API_TOKEN || "",
  environment:
    (process.env.GHTK_ENVIRONMENT as GhtkEnvironment) || "sandbox",
  base_url: process.env.GHTK_API_URL || undefined,
  sender_name: process.env.GHTK_SENDER_NAME || "Synapse Store",
  sender_phone: process.env.GHTK_SENDER_PHONE || "0900000000",
  sender_address:
    process.env.GHTK_SENDER_ADDRESS || "Số 1 Lê Duẩn, Bến Nghé, Quận 1",
  sender_province: process.env.GHTK_SENDER_PROVINCE || "Hồ Chí Minh",
  sender_district: process.env.GHTK_SENDER_DISTRICT || "Quận 1",
  sender_ward: process.env.GHTK_SENDER_WARD || "Phường Bến Nghé",
  pick_address_id: process.env.GHTK_PICK_ADDRESS_ID || undefined,
  default_weight: Number(process.env.GHTK_DEFAULT_WEIGHT || "300"),
  default_length: Number(process.env.GHTK_DEFAULT_LENGTH || "15"),
  default_width: Number(process.env.GHTK_DEFAULT_WIDTH || "10"),
  default_height: Number(process.env.GHTK_DEFAULT_HEIGHT || "10"),
  is_freeship: true,
  transport: "road",
}

let runtimeSettings: GhtkFullSettings | null = null

export class GhtkSettingsStore {
  public static getLegacySettings(): GhtkFullSettings {
    return { ...DEFAULT_SETTINGS }
  }

  public static getSettings(): GhtkFullSettings {
    if (runtimeSettings) {
      return { ...runtimeSettings }
    }
    return { ...DEFAULT_SETTINGS }
  }

  public static setRuntimeSettings(settings: Partial<GhtkFullSettings>): void {
    runtimeSettings = {
      ...(runtimeSettings || DEFAULT_SETTINGS),
      ...settings,
    }
  }

  public static clear(): void {
    runtimeSettings = null
  }
}
