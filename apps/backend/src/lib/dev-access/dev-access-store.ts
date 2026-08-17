import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import type { DevAccessSettings, UpdateDevAccessInput } from "./types"

const DEFAULT_SETTINGS: DevAccessSettings = {
  allowed_ips: [],
  access_mode: "passcode",
  maintenance_message:
    "Hệ thống đang trong quá trình phát triển (Dev Mode). Vui lòng nhập mã PIN hoặc liên hệ quản trị viên để mở khóa.",
  passcode: "synapse2026",
  public_access_enabled: false,
  public_domain: "trendhub.sbs",
  updated_at: new Date().toISOString(),
}

const SETTINGS_FILE_PATH = join(
  process.cwd(),
  "data",
  "dev-access-settings.json"
)

export class DevAccessStore {
  private static memoryCache: DevAccessSettings | null = null

  public static getSettings(): DevAccessSettings {
    if (this.memoryCache) {
      return { ...this.memoryCache }
    }

    try {
      if (existsSync(SETTINGS_FILE_PATH)) {
        const raw = readFileSync(SETTINGS_FILE_PATH, "utf-8")
        const parsed = JSON.parse(raw) as Partial<DevAccessSettings>
        this.memoryCache = {
          ...DEFAULT_SETTINGS,
          ...parsed,
        }
        return { ...this.memoryCache }
      }
    } catch {
      // Fallback to default
    }

    this.memoryCache = { ...DEFAULT_SETTINGS }
    return { ...this.memoryCache }
  }

  public static updateSettings(
    input: UpdateDevAccessInput
  ): DevAccessSettings {
    const current = this.getSettings()
    const updated: DevAccessSettings = {
      ...current,
      ...(input.public_access_enabled !== undefined
        ? { public_access_enabled: input.public_access_enabled }
        : {}),
      ...(input.access_mode !== undefined
        ? { access_mode: input.access_mode }
        : {}),
      ...(input.passcode !== undefined
        ? { passcode: input.passcode.trim() }
        : {}),
      ...(input.public_domain !== undefined
        ? { public_domain: input.public_domain.trim().replace(/^https?:\/\//, "") }
        : {}),
      ...(input.maintenance_message !== undefined
        ? { maintenance_message: input.maintenance_message.trim() }
        : {}),
      ...(input.allowed_ips !== undefined ? { allowed_ips: input.allowed_ips } : {}),
      updated_at: new Date().toISOString(),
    }

    this.memoryCache = updated

    try {
      const dir = dirname(SETTINGS_FILE_PATH)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8")
    } catch (err) {
      console.error("[DevAccessStore] Failed to write settings to disk:", err)
    }

    return { ...updated }
  }

  public static verifyPasscode(inputPasscode: string): boolean {
    if (!inputPasscode) return false
    const settings = this.getSettings()
    return settings.passcode.trim() === inputPasscode.trim()
  }
}
