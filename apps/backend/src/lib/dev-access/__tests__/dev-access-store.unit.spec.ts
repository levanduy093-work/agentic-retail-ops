import { DevAccessStore } from "../dev-access-store"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("DevAccessStore", () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "dev-access-store-"))
    DevAccessStore.resetForTesting(join(directory, "settings.json"))
  })

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true })
    delete process.env.DEV_ACCESS_SETTINGS_FILE
    DevAccessStore.resetForTesting()
  })

  it("defaults to private without a configured PIN", () => {
    const settings = DevAccessStore.getSettings()
    expect(settings).toBeDefined()
    expect(settings.public_access_enabled).toBe(false)
    expect(settings.passcode_hash).toBe("")
  })

  it("hashes the PIN, persists atomically, and signs sessions", () => {
    DevAccessStore.updateSettings({
      passcode: "testpin123",
      public_access_enabled: true,
    })

    const updated = DevAccessStore.getSettings()
    expect(updated.public_access_enabled).toBe(true)
    expect(updated.passcode_hash).not.toContain("testpin123")
    expect(existsSync(process.env.DEV_ACCESS_SETTINGS_FILE!)).toBe(true)

    expect(DevAccessStore.verifyPasscode("testpin123")).toBe(true)
    expect(DevAccessStore.verifyPasscode("wrongpin")).toBe(false)

    const token = DevAccessStore.createSessionToken()
    expect(DevAccessStore.verifySessionToken(token)).toBe(true)
    expect(DevAccessStore.verifySessionToken(`${token}tampered`)).toBe(false)
  })
})
