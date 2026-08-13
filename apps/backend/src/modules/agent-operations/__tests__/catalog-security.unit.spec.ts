import { CUSTOMER_CATALOG_READER_ACTOR_ID } from "../catalog-read-runtime"
import {
  buildTrustedProductUrl,
  resolveTrustedStorefrontOrigin,
} from "../storefront-product-url"
import { CATALOG_READ_TOOL, CatalogReadInput } from "../tools/catalog-tools"

describe("customer catalog security boundary", () => {
  const environment = {
    CUSTOMER_STOREFRONT_BASE_URL: "https://shop.example",
    NODE_ENV: "production",
    STORE_CORS: "https://shop.example,https://admin.example",
  }

  it("keeps customer catalog access fixed, read-only and bounded", () => {
    expect(CUSTOMER_CATALOG_READER_ACTOR_ID).toBe("customer-product-advisor")
    expect(CATALOG_READ_TOOL).toMatchObject({
      approval_required: false,
      kind: "READ",
      permission: "agent_catalog:read",
      risk_level: "READ_ONLY",
    })
    expect(
      CatalogReadInput.safeParse({
        filters: { status: "draft" },
        limit: 8,
        locale: "vi",
      }).success
    ).toBe(false)
    expect(
      CatalogReadInput.safeParse({ limit: 13, locale: "vi" }).success
    ).toBe(false)
    expect(
      CatalogReadInput.safeParse({
        locale: "vi",
        query: "x".repeat(161),
      }).success
    ).toBe(false)
  })

  it("builds links only on the configured CORS-approved storefront origin", () => {
    expect(resolveTrustedStorefrontOrigin(environment)).toBe(
      "https://shop.example"
    )
    expect(
      buildTrustedProductUrl({
        country_code: "vn",
        environment,
        handle: "ao-thun-cotton",
        locale: "vi",
      })
    ).toBe("https://shop.example/vi/vn/products/ao-thun-cotton")
    expect(
      resolveTrustedStorefrontOrigin({
        ...environment,
        CUSTOMER_STOREFRONT_BASE_URL: "https://attacker.example",
      })
    ).toBeNull()
  })

  it("rejects unsafe public HTTP origins, credentials and path-like handles", () => {
    expect(
      resolveTrustedStorefrontOrigin({
        CUSTOMER_STOREFRONT_BASE_URL: "http://shop.example",
        NODE_ENV: "production",
        STORE_CORS: "http://shop.example",
      })
    ).toBeNull()
    expect(
      resolveTrustedStorefrontOrigin({
        CUSTOMER_STOREFRONT_BASE_URL: "https://user:pass@shop.example",
        NODE_ENV: "production",
        STORE_CORS: "https://shop.example",
      })
    ).toBeNull()
    expect(
      buildTrustedProductUrl({
        country_code: "vn",
        environment,
        handle: "../../admin?token=1",
        locale: "vi",
      })
    ).toBeNull()
  })
})
