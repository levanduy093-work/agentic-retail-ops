import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import type {
  DevAccessSettings,
  PublicDevAccessSettings,
  UpdateDevAccessInput,
} from "./types"

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

const DEFAULT_SETTINGS: DevAccessSettings = {
  passcode_hash: "",
  public_access_enabled: false,
  updated_at: new Date().toISOString(),
}

function settingsFilePath() {
  return process.env.DEV_ACCESS_SETTINGS_FILE || join(process.cwd(), "data", "dev-access-settings.json")
}

function hashPasscode(passcode: string, salt = randomBytes(16).toString("base64url")) {
  const hash = scryptSync(passcode, salt, 64).toString("base64url")
  return `scrypt$${salt}$${hash}`
}

function matchesPasscode(passcode: string, storedHash: string) {
  const [algorithm, salt, expectedHash, extra] = storedHash.split("$")
  if (algorithm !== "scrypt" || !salt || !expectedHash || extra) return false

  const actual = Buffer.from(scryptSync(passcode, salt, 64).toString("base64url"))
  const expected = Buffer.from(expectedHash)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function sessionSecret() {
  const secret = process.env.DEV_ACCESS_SESSION_SECRET?.trim() || process.env.COOKIE_SECRET?.trim() || process.env.JWT_SECRET?.trim()
  if (!secret) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Dev Access requires DEV_ACCESS_SESSION_SECRET or COOKIE_SECRET."
    )
  }
  return secret
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
}

type StoredSettings = Partial<DevAccessSettings> & { passcode?: unknown }

export class DevAccessStore {
  private static memoryCache: DevAccessSettings | null = null

  private static writeSettings(settings: DevAccessSettings) {
    const filePath = settingsFilePath()
    mkdirSync(dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`
    writeFileSync(temporaryPath, JSON.stringify(settings, null, 2), "utf-8")
    renameSync(temporaryPath, filePath)
  }

  public static getSettings(): DevAccessSettings {
    if (this.memoryCache) {
      return { ...this.memoryCache }
    }

    let raw: StoredSettings = {}
    try {
      const filePath = settingsFilePath()
      if (existsSync(filePath)) raw = JSON.parse(readFileSync(filePath, "utf-8")) as StoredSettings
    } catch {
      raw = {}
    }

    const legacyPasscode = typeof raw.passcode === "string" ? raw.passcode.trim() : ""
    this.memoryCache = {
      ...DEFAULT_SETTINGS,
      passcode_hash:
        typeof raw.passcode_hash === "string" && raw.passcode_hash
          ? raw.passcode_hash
          : legacyPasscode
            ? hashPasscode(legacyPasscode)
            : "",
      public_access_enabled: raw.public_access_enabled === true,
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
    }
    if (legacyPasscode) this.writeSettings(this.memoryCache)
    return { ...this.memoryCache }
  }

  public static getPublicSettings(): PublicDevAccessSettings {
    const settings = this.getSettings()
    return {
      has_passcode: Boolean(settings.passcode_hash),
      public_access_enabled: settings.public_access_enabled,
      updated_at: settings.updated_at,
    }
  }

  public static updateSettings(
    input: UpdateDevAccessInput
  ): PublicDevAccessSettings {
    const current = this.getSettings()
    const passcode = input.passcode?.trim()
    if (passcode !== undefined && passcode.length > 0 && passcode.length < 8) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Mã PIN phải có ít nhất 8 ký tự.")
    }
    const updated: DevAccessSettings = {
      passcode_hash: passcode ? hashPasscode(passcode) : current.passcode_hash,
      public_access_enabled: input.public_access_enabled === undefined ? current.public_access_enabled : input.public_access_enabled,
      updated_at: new Date().toISOString(),
    }
    if (!updated.public_access_enabled && !updated.passcode_hash) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cần đặt mã PIN trước khi chuyển hệ thống sang Private."
      )
    }

    this.writeSettings(updated)
    this.memoryCache = updated
    return this.getPublicSettings()
  }

  public static verifyPasscode(inputPasscode: string): boolean {
    const settings = this.getSettings()
    return Boolean(inputPasscode) && matchesPasscode(inputPasscode.trim(), settings.passcode_hash)
  }

  public static createSessionToken() {
    const payload = Buffer.from(JSON.stringify({ expires_at: Date.now() + SESSION_TTL_SECONDS * 1000, nonce: randomBytes(18).toString("base64url"), settings_updated_at: this.getSettings().updated_at }), "utf-8").toString("base64url")
    return `${payload}.${signSessionPayload(payload)}`
  }

  public static verifySessionToken(token: string): boolean {
    const [payload, signature, extra] = token.split(".")
    if (!payload || !signature || extra) return false
    const supplied = Buffer.from(signature)
    const expected = Buffer.from(signSessionPayload(payload))
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false
    try {
      const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as { expires_at?: number; settings_updated_at?: string }
      return (
        typeof session.expires_at === "number" &&
        session.expires_at > Date.now() &&
        session.settings_updated_at === this.getSettings().updated_at
      )
    } catch {
      return false
    }
  }

  public static resetForTesting(filePath?: string) {
    if (filePath) process.env.DEV_ACCESS_SETTINGS_FILE = filePath
    this.memoryCache = null
  }
}
