import type { ICachingModuleService } from "@medusajs/framework/types"
import {
  buildCustomerAssistantCacheKey,
  CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS,
  normalizeCustomerCacheText,
  readCustomerAssistantCache,
  writeCustomerAssistantCache,
} from "../customer-assistant-cache"

describe("customer assistant cache", () => {
  it("creates stable opaque keys and isolates tenants", () => {
    const first = buildCustomerAssistantCacheKey("answer", {
      question: "  Trả HÀNG thế nào? ",
      tenant_id: "tenant-a",
    })
    const reordered = buildCustomerAssistantCacheKey("answer", {
      tenant_id: "tenant-a",
      question: "  Trả HÀNG thế nào? ",
    })
    const otherTenant = buildCustomerAssistantCacheKey("answer", {
      question: "  Trả HÀNG thế nào? ",
      tenant_id: "tenant-b",
    })

    expect(first).toBe(reordered)
    expect(first).not.toBe(otherTenant)
    expect(first).not.toContain("Trả HÀNG")
    expect(normalizeCustomerCacheText("  Trả   HÀNG ")).toBe("trả hàng")
  })

  it("uses short freshness windows for live catalog data", () => {
    expect(CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.catalog).toBeLessThanOrEqual(10)
    expect(
      CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.knowledge_search
    ).toBeGreaterThan(CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS.catalog)
  })

  it("fails open when cache is unavailable", async () => {
    const failing = {
      get: jest.fn().mockRejectedValue(new Error("cache unavailable")),
      set: jest.fn().mockRejectedValue(new Error("cache unavailable")),
    } as unknown as ICachingModuleService

    await expect(
      readCustomerAssistantCache(failing, "key", () => ({ ok: true }))
    ).resolves.toBeNull()
    await expect(
      writeCustomerAssistantCache(failing, {
        key: "key",
        tags: ["tenant:one"],
        ttl: 10,
        value: { ok: true },
      })
    ).resolves.toBeUndefined()
  })
})
