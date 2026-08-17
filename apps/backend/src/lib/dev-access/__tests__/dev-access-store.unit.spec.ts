import { DevAccessStore } from "../dev-access-store"

describe("DevAccessStore", () => {
  it("should return default settings", () => {
    const settings = DevAccessStore.getSettings()
    expect(settings).toBeDefined()
    expect(settings.public_domain).toBe("trendhub.sbs")
    expect(typeof settings.public_access_enabled).toBe("boolean")
  })

  it("should update settings and persist changes", () => {
    DevAccessStore.updateSettings({
      passcode: "testpin123",
      public_access_enabled: true,
      public_domain: "trendhub.sbs",
    })

    const updated = DevAccessStore.getSettings()
    expect(updated.public_access_enabled).toBe(true)
    expect(updated.passcode).toBe("testpin123")

    expect(DevAccessStore.verifyPasscode("testpin123")).toBe(true)
    expect(DevAccessStore.verifyPasscode("wrongpin")).toBe(false)

    // Reset back to safe dev mode
    DevAccessStore.updateSettings({
      passcode: "synapse2026",
      public_access_enabled: false,
    })
    expect(DevAccessStore.getSettings().public_access_enabled).toBe(false)
  })
})
